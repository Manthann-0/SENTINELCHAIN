"""
SentinelChain — Supabase Database Client
Provides a singleton Supabase client and helper functions for table operations.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

# ─── Singleton Client ─────────────────────────────────────────────────────────

_client: Client | None = None


def get_client() -> Client:
    """Return a Supabase client, creating one if needed."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in .env"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized for %s", SUPABASE_URL)
    return _client


# ─── Helper Functions ─────────────────────────────────────────────────────────


def insert_rows(table: str, rows: list[dict[str, Any]]) -> list[dict]:
    """Insert multiple rows into a table. Returns inserted rows."""
    if not rows:
        return []
    client = get_client()
    response = client.table(table).insert(rows).execute()
    logger.info("Inserted %d rows into '%s'", len(response.data), table)
    return response.data


def upsert_rows(table: str, rows: list[dict[str, Any]], on_conflict: str = "id") -> list[dict]:
    """Upsert rows (insert or update on conflict)."""
    if not rows:
        return []
    client = get_client()
    response = client.table(table).upsert(rows, on_conflict=on_conflict).execute()
    logger.info("Upserted %d rows into '%s'", len(response.data), table)
    return response.data


def query_table(
    table: str,
    select: str = "*",
    filters: dict[str, Any] | None = None,
    order_by: str | None = None,
    order_desc: bool = True,
    limit: int | None = None,
) -> list[dict]:
    """
    Query a table with optional filters, ordering, and limit.
    
    Filters are applied as equality checks: {"corridor_id": "hormuz"}
    For time-range queries, use query_table_raw() instead.
    """
    client = get_client()
    query = client.table(table).select(select)

    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)

    if order_by:
        query = query.order(order_by, desc=order_desc)

    if limit:
        query = query.limit(limit)

    response = query.execute()
    return response.data


def query_recent_events(corridor_id: str, hours: int = 48) -> list[dict]:
    """Fetch events for a corridor from the last N hours."""
    client = get_client()
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    response = (
        client.table("events")
        .select("*")
        .eq("corridor_id", corridor_id)
        .gte("event_at", cutoff)
        .order("event_at", desc=True)
        .execute()
    )
    return response.data


def query_supplier_recent_events(supplier: str, hours: int = 48) -> list[dict]:
    """Fetch events for a supplier from the last N hours by checking headline for keywords."""
    # Since events are currently tagged by corridor_id but not supplier_country,
    # we will fetch recent events and filter by supplier keywords in Python.
    from config import SUPPLIERS
    client = get_client()
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    response = (
        client.table("events")
        .select("*")
        .gte("event_at", cutoff)
        .order("event_at", desc=True)
        .execute()
    )
    
    keywords = SUPPLIERS.get(supplier, {}).get("keywords", [supplier])
    keywords_lower = [kw.lower() for kw in keywords]
    
    filtered_events = []
    for evt in response.data:
        headline = evt.get("headline", "").lower()
        if any(kw in headline for kw in keywords_lower):
            filtered_events.append(evt)
            
    return filtered_events


def query_risk_history(corridor_id: str, days: int = 7) -> list[dict]:
    """Fetch risk score history for a corridor over the last N days."""
    client = get_client()
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    response = (
        client.table("risk_scores")
        .select("*")
        .eq("corridor_id", corridor_id)
        .gte("computed_at", cutoff)
        .order("computed_at", desc=True)
        .execute()
    )
    return response.data


def get_latest_risk_scores() -> list[dict]:
    """Get the most recent risk score for each corridor."""
    results = []
    for corridor_id in ["hormuz", "red_sea", "malacca"]:
        rows = query_table(
            "risk_scores",
            filters={"corridor_id": corridor_id},
            order_by="computed_at",
            order_desc=True,
            limit=1,
        )
        if rows:
            results.append(rows[0])
    return results


def query_supplier_risk_history(supplier: str, days: int = 7) -> list[dict]:
    """Fetch risk score history for a supplier over the last N days."""
    client = get_client()
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    response = (
        client.table("supplier_risk_scores")
        .select("*")
        .eq("supplier_country", supplier)
        .gte("computed_at", cutoff)
        .order("computed_at", desc=True)
        .execute()
    )
    return response.data


def get_latest_supplier_risk_scores() -> list[dict]:
    """Get the most recent risk score for each supplier."""
    from config import SUPPLIERS
    results = []
    for supplier in SUPPLIERS.keys():
        rows = query_table(
            "supplier_risk_scores",
            filters={"supplier_country": supplier},
            order_by="computed_at",
            order_desc=True,
            limit=1,
        )
        if rows:
            results.append(rows[0])
    return results


def get_latest_prices() -> list[dict]:
    """Get the most recent price for each commodity."""
    results = []
    for commodity in ["Brent", "WTI"]:
        rows = query_table(
            "prices",
            filters={"commodity": commodity, "source": "EIA"},
            order_by="recorded_at",
            order_desc=True,
            limit=1,
        )
        if rows:
            results.append(rows[0])
    return results


def check_event_exists(url: str) -> bool:
    """Check if an event with the given URL already exists (deduplication)."""
    client = get_client()
    response = (
        client.table("events")
        .select("id")
        .eq("url", url)
        .limit(1)
        .execute()
    )
    return len(response.data) > 0
