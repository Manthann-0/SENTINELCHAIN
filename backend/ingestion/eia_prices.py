"""
SentinelChain - EIA Price Ingestion
Fetches Brent and WTI crude oil spot prices from the U.S. EIA Open Data API v2.
If the API is unavailable, ingestion fails visibly instead of inserting mock prices.
"""

import logging
from datetime import datetime, timezone

import httpx

from config import EIA_API_KEY
from database import insert_rows
from ingestion.diagnostics import (
    log_ingest_start,
    log_key_status,
    log_no_fallback,
    log_query,
    log_request,
    log_response,
)

logger = logging.getLogger(__name__)

EIA_API_BASE = "https://api.eia.gov/v2/petroleum/pri/spt/data/"

COMMODITIES = {
    "Brent": {"product": "EPCBRENT", "series": "PET.RBRTE.D"},
    "WTI": {"product": "EPCWTI", "series": "PET.RWTC.D"},
}


def fetch_eia_prices() -> tuple[list[dict], list[str]]:
    """
    Fetch the latest 30 days of Brent and WTI spot prices from EIA API v2.
    Returns (prices, errors). No mock/fallback prices are generated.
    """
    if not EIA_API_KEY:
        reason = "EIA_API_KEY missing"
        log_no_fallback("EIA", reason)
        return [], [reason]

    all_prices = []
    errors = []

    for commodity_name, info in COMMODITIES.items():
        params = {
            "api_key": EIA_API_KEY,
            "frequency": "daily",
            "data[0]": "value",
            "facets[product][]": info["product"],
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            "length": 30,
        }
        log_query("EIA", f"commodity={commodity_name} product={info['product']}", "latest 30 daily records")
        log_request("EIA", "GET", EIA_API_BASE, params)

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(EIA_API_BASE, params=params)
                log_response("EIA", response)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as e:
            body = e.response.text[:300].replace("\n", "\\n") if e.response is not None else ""
            status = e.response.status_code if e.response is not None else "unknown"
            message = f"{commodity_name} HTTP {status}: {body}"
            logger.error("EIA API error for %s: status=%s body=%r", commodity_name, status, body)
            log_no_fallback("EIA", message)
            errors.append(message)
            continue
        except Exception as e:
            message = f"{commodity_name} request failed: {type(e).__name__}"
            logger.error("EIA API error for %s: %s", commodity_name, type(e).__name__)
            log_no_fallback("EIA", message)
            errors.append(message)
            continue

        records = data.get("response", {}).get("data", [])
        if not records:
            message = f"{commodity_name} returned no records"
            logger.warning("No EIA data for %s", commodity_name)
            log_no_fallback("EIA", message)
            errors.append(message)
            continue

        for record in records:
            value = record.get("value")
            period = record.get("period", "")
            if value is None:
                continue

            try:
                recorded_at = datetime.strptime(period, "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                ).isoformat()
            except ValueError:
                recorded_at = datetime.now(timezone.utc).isoformat()

            all_prices.append({
                "commodity": commodity_name,
                "price": float(value),
                "source": "EIA",
                "recorded_at": recorded_at,
            })

        logger.info("Fetched %d price records for %s", len(records), commodity_name)

    return all_prices, errors


def ingest_eia_prices() -> dict:
    """
    Main ingestion: fetch EIA prices and insert into the prices table.
    Returns summary stats.
    """
    log_ingest_start("EIA")
    log_key_status("EIA", "EIA_API_KEY", EIA_API_KEY)
    stats = {"fetched": 0, "inserted": 0, "errors": []}

    prices, errors = fetch_eia_prices()
    stats["errors"] = errors
    stats["fetched"] = len(prices)

    if prices:
        try:
            inserted = insert_rows("prices", prices)
            stats["inserted"] = len(inserted)
        except Exception as e:
            logger.error("Failed to insert prices: %s", e)

    logger.info(
        "EIA ingestion complete: %d fetched, %d inserted, %d errors",
        stats["fetched"],
        stats["inserted"],
        len(stats["errors"]),
    )
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = ingest_eia_prices()
    print(f"EIA ingestion: {result}")
