"""
SentinelChain — GDELT Ingestion
Pulls geopolitical headlines from the GDELT DOC 2.0 API (free, no key required).
Maps events to shipping corridors and writes to both Postgres and Chroma.
"""

import hashlib
import logging
import time
from datetime import datetime, timedelta, timezone

import httpx

from config import CORRIDORS, GENERAL_KEYWORDS
from database import insert_rows, check_event_exists
from vector_store import add_documents
from ingestion.diagnostics import log_ingest_start, log_query, log_request, log_response

logger = logging.getLogger(__name__)

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"

# GDELT has strict informal rate limits, so use one compact query per run.
MAX_RECORDS = 75
LOOKBACK_HOURS = 48

GDELT_QUERY_TERMS = [
    "Hormuz",
    "Red Sea",
    "Houthi",
    "Suez Canal",
    "Malacca",
    "South China Sea",
    "oil tanker",
]


def _keyword_query(keywords: list[str]) -> str:
    """Build a GDELT query string from a keyword list."""
    # GDELT uses space-separated OR terms; phrases in quotes
    terms = []
    for kw in keywords:
        if " " in kw or "-" in kw:
            terms.append(f'"{kw}"')
        else:
            terms.append(kw)
    return " OR ".join(terms)


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
    return f"gdelt_{hashlib.md5(url.encode()).hexdigest()}"


def _gdelt_timestamp(value: datetime) -> str:
    return value.strftime("%Y%m%d%H%M%S")


def fetch_gdelt_articles(keywords: list[str], max_records: int = MAX_RECORDS) -> list[dict]:
    """
    Fetch articles from GDELT DOC 2.0 API.
    Returns list of {title, url, seendate, domain, source_domain}.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=LOOKBACK_HOURS)
    query = f"({_keyword_query(keywords)})"
    params = {
        "query": query,
        "mode": "artlist",
        "format": "json",
        "maxrecords": str(max_records),
        "startdatetime": _gdelt_timestamp(start),
        "enddatetime": _gdelt_timestamp(now),
        "sort": "DateDesc",
    }
    log_query("GDELT", query, f"{start.isoformat()} to {now.isoformat()}")
    log_request("GDELT", "GET", GDELT_DOC_API, params)

    try:
        with httpx.Client(timeout=30.0) as client:
            for attempt in range(2):
                response = client.get(GDELT_DOC_API, params=params)
                log_response("GDELT", response)
                if response.status_code != 429 or attempt == 1:
                    break
                logger.warning("GDELT rate-limited; retrying once after 6 seconds")
                time.sleep(6)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        body = e.response.text[:300].replace("\n", "\\n") if e.response is not None else ""
        logger.error("GDELT API HTTP error: status=%s body=%r", e.response.status_code, body)
        return []
    except Exception as e:
        logger.error("GDELT API request failed: %s", type(e).__name__)
        return []

    articles = data.get("articles", [])
    logger.info("GDELT returned %d articles for query: %s", len(articles), query[:80])
    return articles


def ingest_gdelt() -> dict:
    """
    Main ingestion function: fetch GDELT articles, classify by corridor,
    write to events table and Chroma vector store.
    
    Returns summary stats.
    """
    log_ingest_start("GDELT")
    stats = {"fetched": 0, "new_events": 0, "new_docs": 0, "skipped": 0, "unclassified": 0}

    articles = []
    seen_urls = set()
    for article in fetch_gdelt_articles(GDELT_QUERY_TERMS, max_records=MAX_RECORDS):
        url = article.get("url", "").strip()
        if url and url not in seen_urls:
            seen_urls.add(url)
            articles.append(article)
    stats["fetched"] = len(articles)

    if not articles:
        logger.warning("No GDELT articles fetched")
        return stats

    event_rows = []
    doc_texts = []
    doc_metadatas = []
    doc_ids = []

    for article in articles:
        title = article.get("title", "").strip()
        url = article.get("url", "").strip()
        seen_date = article.get("seendate", "")
        domain = article.get("domain", "")

        if not title or not url:
            continue

        # Dedup check
        if check_event_exists(url):
            stats["skipped"] += 1
            continue

        # Classify corridor
        corridor_id = _classify_corridor(title)
        if not corridor_id:
            stats["skipped"] += 1
            stats["unclassified"] += 1
            continue

        # Parse date
        try:
            event_at = datetime.strptime(
                seen_date[:14], "%Y%m%d%H%M%S"
            ).replace(tzinfo=timezone.utc).isoformat()
        except (ValueError, IndexError):
            event_at = datetime.now(timezone.utc).isoformat()

        event_rows.append({
            "headline": title[:500],
            "corridor_id": corridor_id,
            "url": url,
            "event_at": event_at,
        })

        doc_id = _make_doc_id(url)
        doc_texts.append(title)
        doc_metadatas.append({
            "source_url": url,
            "corridor_id": corridor_id,
            "published_at": event_at,
            "source": "gdelt",
            "domain": domain,
        })
        doc_ids.append(doc_id)

    # Batch insert to Postgres
    if event_rows:
        try:
            inserted = insert_rows("events", event_rows)
            stats["new_events"] = len(inserted)
        except Exception as e:
            logger.error("Failed to insert GDELT events: %s", e)

    # Batch insert to Chroma
    if doc_texts:
        try:
            n_added = add_documents(doc_texts, doc_metadatas, doc_ids)
            stats["new_docs"] = n_added
        except Exception as e:
            logger.error("Failed to add GDELT docs to Chroma: %s", e)

    logger.info(
        "GDELT ingestion complete: %d fetched, %d new events, %d new docs, %d skipped",
        stats["fetched"], stats["new_events"], stats["new_docs"], stats["skipped"],
    )
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = ingest_gdelt()
    print(f"GDELT ingestion: {result}")
