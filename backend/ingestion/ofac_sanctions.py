"""
SentinelChain — OFAC Sanctions Ingestion
Loads a curated subset of the OFAC SDN sanctions list (focused on Iran,
maritime, and energy-related entities) into the sanctions table.
"""

import csv
import logging
from pathlib import Path

from database import insert_rows, query_table

logger = logging.getLogger(__name__)

SDN_CSV_PATH = Path(__file__).parent.parent / "data" / "ofac_sdn_subset.csv"


def ingest_ofac_sanctions() -> dict:
    """
    Load OFAC SDN sanctions data from the bundled CSV file.
    Idempotent: skips entities that already exist in the table.
    
    Returns summary stats.
    """
    stats = {"loaded": 0, "new": 0, "skipped": 0}

    if not SDN_CSV_PATH.exists():
        logger.error("OFAC SDN CSV not found at: %s", SDN_CSV_PATH)
        return stats

    # Load existing entity names for dedup
    existing = query_table("sanctions", select="entity_name")
    existing_names = {row["entity_name"].lower() for row in existing}

    rows_to_insert = []

    with open(SDN_CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stats["loaded"] += 1
            entity_name = row.get("entity_name", "").strip()
            if not entity_name:
                continue

            if entity_name.lower() in existing_names:
                stats["skipped"] += 1
                continue

            rows_to_insert.append({
                "entity_name": entity_name,
                "country": row.get("country", "").strip(),
                "category": row.get("category", "").strip(),
                "date_added": row.get("date_added", None) or None,
            })

    if rows_to_insert:
        try:
            inserted = insert_rows("sanctions", rows_to_insert)
            stats["new"] = len(inserted)
        except Exception as e:
            logger.error("Failed to insert sanctions: %s", e)

    logger.info(
        "OFAC ingestion complete: %d loaded, %d new, %d skipped",
        stats["loaded"], stats["new"], stats["skipped"],
    )
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = ingest_ofac_sanctions()
    print(f"OFAC ingestion: {result}")
