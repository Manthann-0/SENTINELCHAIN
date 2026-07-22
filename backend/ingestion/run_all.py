"""
SentinelChain — Ingestion Pipeline Orchestrator
Runs all data source ingestion modules in sequence with timing and summary.
"""

import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


def run_all_ingestion() -> dict:
    """
    Execute the full ingestion pipeline:
    1. GDELT geopolitical headlines
    2. NewsAPI supplementary headlines
    3. EIA crude oil prices
    4. AIS vessel positions
    5. OFAC sanctions list
    
    Returns a summary dict with per-source stats and total timing.
    """
    start = time.time()
    results = {}

    logger.info("=" * 60)
    logger.info("SENTINELCHAIN INGESTION PIPELINE — %s",
                datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    logger.info("=" * 60)

    # 1. GDELT
    logger.info("\n[1/5] GDELT Geopolitical Events...")
    t = time.time()
    try:
        from ingestion.gdelt import ingest_gdelt
        results["gdelt"] = ingest_gdelt()
    except Exception as e:
        logger.error("GDELT ingestion failed: %s", e)
        results["gdelt"] = {"error": str(e)}
    logger.info("  → %.1fs", time.time() - t)

    # 2. NewsAPI
    logger.info("\n[2/5] NewsAPI Headlines...")
    t = time.time()
    try:
        from ingestion.newsapi import ingest_newsapi
        results["newsapi"] = ingest_newsapi()
    except Exception as e:
        logger.error("NewsAPI ingestion failed: %s", e)
        results["newsapi"] = {"error": str(e)}
    logger.info("  → %.1fs", time.time() - t)

    # 3. EIA Prices
    logger.info("\n[3/5] EIA Crude Oil Prices...")
    t = time.time()
    try:
        from ingestion.eia_prices import ingest_eia_prices
        results["eia"] = ingest_eia_prices()
    except Exception as e:
        logger.error("EIA ingestion failed: %s", e)
        results["eia"] = {"error": str(e)}
    logger.info("  → %.1fs", time.time() - t)

    # 4. AIS Vessels
    logger.info("\n[4/5] AIS Vessel Positions...")
    t = time.time()
    try:
        from ingestion.ais_vessels import ingest_ais_vessels
        results["ais"] = ingest_ais_vessels()
    except Exception as e:
        logger.error("AIS ingestion failed: %s", e)
        results["ais"] = {"error": str(e)}
    logger.info("  → %.1fs", time.time() - t)

    # 5. OFAC Sanctions
    logger.info("\n[5/5] OFAC Sanctions List...")
    t = time.time()
    try:
        from ingestion.ofac_sanctions import ingest_ofac_sanctions
        results["ofac"] = ingest_ofac_sanctions()
    except Exception as e:
        logger.error("OFAC ingestion failed: %s", e)
        results["ofac"] = {"error": str(e)}
    logger.info("  → %.1fs", time.time() - t)

    elapsed = time.time() - start
    results["total_time_seconds"] = round(elapsed, 1)

    logger.info("\n" + "=" * 60)
    logger.info("INGESTION COMPLETE — %.1fs total", elapsed)
    logger.info("=" * 60)

    for source, stats in results.items():
        if source != "total_time_seconds":
            logger.info("  %s: %s", source, stats)

    return results


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    run_all_ingestion()
