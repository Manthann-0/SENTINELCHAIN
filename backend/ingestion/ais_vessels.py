"""
SentinelChain - AIS Vessel Ingestion
Fetches vessel positions from AISHub when credentials are configured.
Missing credentials or API errors are surfaced explicitly; no mock vessel rows
are inserted as if they were live telemetry.
"""

import logging
from datetime import datetime, timezone

import httpx

from config import AISHUB_USERNAME, CORRIDORS
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

AISHUB_API = "https://data.aishub.net/ws.php"


def fetch_ais_live(corridor_id: str) -> tuple[list[dict], str | None]:
    """
    Fetch live AIS data from AISHub for a specific corridor's bounding box.
    Requires AISHUB_USERNAME to be set.
    """
    corridor = CORRIDORS.get(corridor_id)
    if not corridor:
        return [], f"unknown corridor_id={corridor_id}"

    lat_range = corridor["lat_range"]
    lon_range = corridor["lon_range"]

    params = {
        "username": AISHUB_USERNAME,
        "format": "1",
        "output": "json",
        "compress": "0",
        "latmin": str(lat_range[0]),
        "latmax": str(lat_range[1]),
        "lonmin": str(lon_range[0]),
        "lonmax": str(lon_range[1]),
    }
    log_query(
        "AISHub",
        f"corridor_id={corridor_id}",
        f"lat={lat_range[0]}..{lat_range[1]} lon={lon_range[0]}..{lon_range[1]}",
    )
    log_request("AISHub", "GET", AISHUB_API, params)

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(AISHUB_API, params=params)
            log_response("AISHub", response)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        body = e.response.text[:300].replace("\n", "\\n") if e.response is not None else ""
        status = e.response.status_code if e.response is not None else "unknown"
        message = f"{corridor_id} HTTP {status}: {body}"
        logger.error("AISHub API error for %s: status=%s body=%r", corridor_id, status, body)
        log_no_fallback("AISHub", message)
        return [], message
    except Exception as e:
        message = f"{corridor_id} request failed: {type(e).__name__}"
        logger.error("AISHub API error for %s: %s", corridor_id, type(e).__name__)
        log_no_fallback("AISHub", message)
        return [], message

    if isinstance(data, list) and len(data) >= 2:
        vessels = data[1] if isinstance(data[1], list) else []
    else:
        vessels = []

    results = []
    for v in vessels:
        results.append({
            "vessel_id": str(v.get("MMSI", "")),
            "lat": float(v.get("LATITUDE", 0)),
            "lon": float(v.get("LONGITUDE", 0)),
            "corridor_id": corridor_id,
            "status": v.get("NAVSTAT", "unknown"),
            "snapshot_at": datetime.now(timezone.utc).isoformat(),
        })

    logger.info("AISHub: %d vessels in %s", len(results), corridor_id)
    return results, None


def ingest_ais_vessels() -> dict:
    """
    Main ingestion: fetch AIS vessel positions and insert into the vessels table.
    Returns summary stats.
    """
    log_ingest_start("AISHub")
    log_key_status("AISHub", "AISHUB_USERNAME", AISHUB_USERNAME)
    stats = {"source": "unavailable", "fetched": 0, "inserted": 0, "errors": []}

    if not AISHUB_USERNAME:
        reason = "AISHUB_USERNAME missing"
        log_no_fallback("AISHub", reason)
        stats["errors"].append(reason)
        logger.info("AIS ingestion unavailable: %s", reason)
        return stats

    stats["source"] = "live"
    all_vessels = []
    for corridor_id in ["hormuz", "red_sea"]:
        vessels, error = fetch_ais_live(corridor_id)
        if error:
            stats["errors"].append(error)
        all_vessels.extend(vessels)
    stats["fetched"] = len(all_vessels)

    if all_vessels:
        try:
            inserted = insert_rows("vessels", all_vessels)
            stats["inserted"] = len(inserted)
        except Exception as e:
            logger.error("Failed to insert vessels: %s", e)

    logger.info(
        "AIS ingestion complete (%s): %d fetched, %d inserted, %d errors",
        stats["source"],
        stats["fetched"],
        stats["inserted"],
        len(stats["errors"]),
    )
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = ingest_ais_vessels()
    print(f"AIS ingestion: {result}")
