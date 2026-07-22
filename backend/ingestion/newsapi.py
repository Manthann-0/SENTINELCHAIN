"""
SentinelChain — NewsAPI Ingestion
Supplementary headline source using NewsAPI.org /v2/everything endpoint.
Gracefully skips if NEWSAPI_KEY is not configured.
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import httpx

from config import NEWSAPI_KEY, CORRIDORS, GENERAL_KEYWORDS
from database import insert_rows, check_event_exists
from vector_store import add_documents
from ingestion.diagnostics import (
    log_ingest_start,
    log_key_status,
    log_query,
    log_request,
    log_response,
)

logger = logging.getLogger(__name__)

NEWSAPI_URL = "https://newsapi.org/v2/everything"
LOOKBACK_HOURS = 48


def _classify_corridor(title: str) -> str | None:
    """Determine which corridor an article belongs to based on keyword matching."""
    title_lower = title.lower()
    for corridor_id, corridor in CORRIDORS.items():
        for keyword in corridor["keywords"]:
            if keyword.lower() in title_lower:
                return corridor_id
    return None


def _make_doc_id(url: str) -> str:
    """Create a deterministic document ID from a URL."""
    return f"newsapi_{hashlib.md5(url.encode()).hexdigest()}"


def ingest_newsapi() -> dict:
    """
    Fetch headlines from NewsAPI and ingest into events + Chroma.
    Skips gracefully if NEWSAPI_KEY is not set.
    
    Returns summary stats.
    """
    log_ingest_start("NewsAPI")
    log_key_status("NewsAPI", "NEWSAPI_KEY", NEWSAPI_KEY)
    stats = {"fetched": 0, "new_events": 0, "new_docs": 0, "skipped": 0, "unclassified": 0}

    if not NEWSAPI_KEY:
        logger.warning("NEWSAPI_KEY not set — skipping NewsAPI ingestion")
        return stats

    # Build query: combine corridor keywords + general keywords
    query = (
        '("Hormuz" OR "Red Sea" OR Houthi OR "Bab-el-Mandeb" OR '
        '"Suez Canal" OR Malacca OR "Singapore Strait" OR "oil tanker" OR "crude oil") '
        "AND (shipping OR tanker OR sanctions OR OPEC OR disruption)"
    )
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=LOOKBACK_HOURS)

    params = {
        "q": query,
        "language": "en",
        "pageSize": 50,
        "sortBy": "publishedAt",
        "from": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "apiKey": NEWSAPI_KEY,
    }
    log_query("NewsAPI", query, f"{start.isoformat()} to {now.isoformat()}")
    log_request("NewsAPI", "GET", NEWSAPI_URL, params)

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(NEWSAPI_URL, params=params)
            log_response("NewsAPI", response)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        body = e.response.text[:300].replace("\n", "\\n") if e.response is not None else ""
        logger.error("NewsAPI HTTP error: status=%s body=%r", e.response.status_code, body)
        return stats
    except Exception as e:
        logger.error("NewsAPI request failed: %s", type(e).__name__)
        return stats

    if data.get("status") != "ok":
        logger.error("NewsAPI returned error: %s", data.get("message", "unknown"))
        return stats

    articles = data.get("articles", [])
    stats["fetched"] = len(articles)
    logger.info("NewsAPI returned %d articles", len(articles))

    event_rows = []
    doc_texts = []
    doc_metadatas = []
    doc_ids = []

    for article in articles:
        title = article.get("title", "").strip()
        url = article.get("url", "").strip()
        published = article.get("publishedAt", "")
        source_name = article.get("source", {}).get("name", "")

        if not title or not url or title == "[Removed]":
            continue

        # Dedup
        if check_event_exists(url):
            stats["skipped"] += 1
            continue

        corridor_id = _classify_corridor(title)
        if not corridor_id:
            # Use description for secondary classification
            desc = article.get("description", "") or ""
            corridor_id = _classify_corridor(desc)
        if not corridor_id:
            stats["skipped"] += 1
            stats["unclassified"] += 1
            continue

        # Parse date
        try:
            event_at = datetime.fromisoformat(
                published.replace("Z", "+00:00")
            ).isoformat()
        except (ValueError, AttributeError):
            event_at = datetime.now(timezone.utc).isoformat()

        # Combine title + description for richer embedding
        full_text = title
        desc = article.get("description")
        if desc and desc != "[Removed]":
            full_text = f"{title}. {desc}"

        event_rows.append({
            "headline": title[:500],
            "corridor_id": corridor_id,
            "url": url,
            "event_at": event_at,
        })

        doc_id = _make_doc_id(url)
        doc_texts.append(full_text[:1000])
        doc_metadatas.append({
            "source_url": url,
            "corridor_id": corridor_id,
            "published_at": event_at,
            "source": "newsapi",
            "domain": source_name,
        })
        doc_ids.append(doc_id)

    # Batch insert
    if event_rows:
        try:
            inserted = insert_rows("events", event_rows)
            stats["new_events"] = len(inserted)
        except Exception as e:
            logger.error("Failed to insert NewsAPI events: %s", e)

    if doc_texts:
        try:
            n_added = add_documents(doc_texts, doc_metadatas, doc_ids)
            stats["new_docs"] = n_added
        except Exception as e:
            logger.error("Failed to add NewsAPI docs to Chroma: %s", e)

    logger.info(
        "NewsAPI ingestion complete: %d fetched, %d new, %d skipped",
        stats["fetched"], stats["new_events"], stats["skipped"],
    )
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = ingest_newsapi()
    print(f"NewsAPI ingestion: {result}")
