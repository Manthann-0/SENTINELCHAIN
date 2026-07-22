"""
SentinelChain — FastAPI Application
Main entry point for the backend API server.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import AISHUB_USERNAME, CORRIDORS
from database import (
    query_table,
    query_recent_events,
    query_risk_history,
    query_supplier_risk_history,
    get_latest_risk_scores,
    get_latest_supplier_risk_scores,
    get_latest_prices,
)
from agents.risk_intelligence import score_all_corridors, score_corridor, score_all_suppliers
from agents.scenario_engine import get_all_scenarios, run_scenario, get_scenario_latest_impact
from agents.procurement_orchestrator import run_procurement_orchestrator
from agents.reserve_optimizer import run_reserve_optimizer
from agents.network_graph import get_network_graph, get_network_impact
from ingestion.run_all import run_all_ingestion

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SentinelChain API starting up...")
    yield
    logger.info("SentinelChain API shutting down...")


# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="SentinelChain API",
    description="AI-Driven Energy Supply Chain Resilience — Geopolitical Risk Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "SentinelChain API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "corridors": list(CORRIDORS.keys()),
    }


# ─── Risk Scoring Endpoints ──────────────────────────────────────────────────

@app.post("/api/risk/refresh")
def refresh_risk_scores():
    """Trigger the Gemini risk agent to re-evaluate all corridors and suppliers."""
    try:
        logger.info("/api/risk/refresh received")
        corridor_results = score_all_corridors()
        supplier_results = score_all_suppliers()
        logger.info(
            "/api/risk/refresh completed: corridors=%d suppliers=%d",
            len(corridor_results),
            len(supplier_results),
        )
        return {
            "status": "ok",
            "corridor_results": corridor_results,
            "supplier_results": supplier_results,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/risk/current")
def get_current_risk():
    """Get the latest risk score for all corridors."""
    try:
        scores = get_latest_risk_scores()
        
        # Enrich with corridor metadata
        enriched = []
        for score in scores:
            corridor_id = score.get("corridor_id", "")
            corridor_info = CORRIDORS.get(corridor_id, {})
            enriched.append({
                **score,
                "corridor_name": corridor_info.get("name", corridor_id),
                "india_share_pct": corridor_info.get("india_share_pct", 0),
                "daily_flow_mbpd": corridor_info.get("daily_flow_mbpd", 0),
            })
        
        return {
            "status": "ok",
            "scores": enriched,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/risk/{corridor_id}/history")
def get_risk_history(corridor_id: str, days: int = 7):
    """Get risk score history for a specific corridor."""
    if corridor_id not in CORRIDORS:
        raise HTTPException(status_code=404, detail=f"Unknown corridor: {corridor_id}")
    
    try:
        history = query_risk_history(corridor_id, days=days)
        return {
            "status": "ok",
            "corridor_id": corridor_id,
            "corridor_name": CORRIDORS[corridor_id]["name"],
            "history": history,
            "days": days,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/risk/suppliers")
def get_supplier_risk():
    """Get the latest computed risk scores for all suppliers."""
    try:
        scores = get_latest_supplier_risk_scores()
        if not scores:
            logger.warning("No supplier_risk_scores rows found; bootstrapping a fresh supplier scoring pass.")
            computed_scores = score_all_suppliers()
            scores = get_latest_supplier_risk_scores()
            # If the database write failed (e.g. due to RLS), use the computed scores directly
            if not scores:
                scores = computed_scores
                logger.warning("Still no rows found after bootstrapping (RLS issue?). Returning computed scores.")
        logger.info("Returning %d supplier risk score rows", len(scores))
        return {
            "status": "ok",
            "scores": scores,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/risk/suppliers/{supplier}/history")
def get_supplier_history(supplier: str, days: int = 7):
    """Get the risk score history for a specific supplier over the last N days."""
    try:
        history = query_supplier_risk_history(supplier, days)
        return {
            "status": "ok",
            "history": history,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Events Endpoints ────────────────────────────────────────────────────────

@app.get("/api/events/{corridor_id}")
def get_corridor_events(corridor_id: str, hours: int = 48, limit: int = 50):
    """Get recent events for a specific corridor."""
    if corridor_id not in CORRIDORS and corridor_id != "all":
        raise HTTPException(status_code=404, detail=f"Unknown corridor: {corridor_id}")
    
    try:
        if corridor_id == "all":
            events = query_table(
                "events",
                order_by="event_at",
                order_desc=True,
                limit=limit,
            )
        else:
            events = query_recent_events(corridor_id, hours=hours)
            events = events[:limit]
        
        return {
            "status": "ok",
            "corridor_id": corridor_id,
            "events": events,
            "count": len(events),
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Prices Endpoint ─────────────────────────────────────────────────────────

@app.get("/api/prices/latest")
def get_latest_price_data():
    """Get the latest Brent and WTI prices."""
    try:
        prices = get_latest_prices()
        return {
            "status": "ok",
            "prices": prices,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/prices/history")
def get_price_history(commodity: str = "Brent", limit: int = 30):
    """Get price history for a commodity."""
    try:
        history = query_table(
            "prices",
            filters={"commodity": commodity, "source": "EIA"},
            order_by="recorded_at",
            order_desc=True,
            limit=limit,
        )
        return {
            "status": "ok",
            "commodity": commodity,
            "history": history,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Vessels Endpoint ─────────────────────────────────────────────────────────

@app.get("/api/vessels/{corridor_id}")
def get_corridor_vessels(corridor_id: str):
    """Get vessel positions for a corridor."""
    if corridor_id not in CORRIDORS and corridor_id != "all":
        raise HTTPException(status_code=404, detail=f"Unknown corridor: {corridor_id}")
    
    try:
        if not AISHUB_USERNAME:
            return {
                "status": "unavailable",
                "corridor_id": corridor_id,
                "vessels": [],
                "count": 0,
                "message": "AISHUB_USERNAME is not configured; stale mock AIS rows are not served.",
            }

        if corridor_id == "all":
            vessels = query_table("vessels", order_by="snapshot_at", order_desc=True, limit=100)
        else:
            vessels = query_table(
                "vessels",
                filters={"corridor_id": corridor_id},
                order_by="snapshot_at",
                order_desc=True,
                limit=50,
            )
        
        return {
            "status": "ok",
            "corridor_id": corridor_id,
            "vessels": vessels,
            "count": len(vessels),
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Sanctions Endpoint ──────────────────────────────────────────────────────

@app.get("/api/sanctions")
def get_sanctions(country: str | None = None, limit: int = 100):
    """Get sanctions entities, optionally filtered by country."""
    try:
        filters = {}
        if country:
            filters["country"] = country
        
        sanctions = query_table(
            "sanctions",
            filters=filters if filters else None,
            limit=limit,
        )
        return {
            "status": "ok",
            "sanctions": sanctions,
            "count": len(sanctions),
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Ingestion Endpoint ──────────────────────────────────────────────────────

@app.post("/api/ingestion/run")
def trigger_ingestion():
    """Trigger the full ingestion pipeline."""
    logger.info("Ingestion pipeline triggered via API")
    try:
        results = run_all_ingestion()
        return {
            "status": "ok",
            "results": results,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Scenario Simulator Endpoints (Stage 2) ─────────────────────────────────

@app.get("/api/scenarios")
def list_scenarios():
    """Get all available disruption scenarios."""
    try:
        scenarios = get_all_scenarios()
        return {
            "status": "ok",
            "scenarios": scenarios,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scenarios/{scenario_id}/run")
def execute_scenario(scenario_id: int):
    """Run the cascade engine for a specific scenario."""
    try:
        impact = run_scenario(scenario_id)
        return {
            "status": "ok",
            "impact": impact,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scenarios/{scenario_id}/impact")
def get_scenario_impact(scenario_id: int):
    """Get the latest computed impact for a scenario."""
    try:
        impact = get_scenario_latest_impact(scenario_id)
        if not impact:
            raise HTTPException(status_code=404, detail="No impact data found for this scenario.")
        return {
            "status": "ok",
            "impact": impact,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Corridor Info Endpoint ──────────────────────────────────────────────────

@app.get("/api/corridors")
def get_corridors():
    """Get static corridor reference data."""
    corridors = []
    for cid, info in CORRIDORS.items():
        corridors.append({
            "id": cid,
            "name": info["name"],
            "india_share_pct": info["india_share_pct"],
            "daily_flow_mbpd": info["daily_flow_mbpd"],
            "description": info["description"],
            "lat_range": info["lat_range"],
            "lon_range": info["lon_range"],
        })
    return {"corridors": corridors}


# ─── Stage 3: Procurement & Reserves ──────────────────────────────────────────

@app.post("/api/scenarios/{scenario_id}/recommend")
def generate_recommendations(scenario_id: int):
    """Run the Procurement Orchestrator and Reserve Optimizer for a scenario."""
    try:
        logger.info("/api/scenarios/%d/recommend received", scenario_id)

        scenario_rows = query_table("scenarios", filters={"id": scenario_id}, limit=1)
        scenario = scenario_rows[0] if scenario_rows else None

        impact_rows = query_table(
            "scenario_impacts",
            filters={"scenario_id": scenario_id},
            order_by="computed_at",
            order_desc=True,
            limit=1,
        )
        impact = impact_rows[0] if impact_rows else None

        corridor_id = (scenario or {}).get("corridor_id")
        corridor_risk_rows = []
        if corridor_id:
            corridor_risk_rows = query_table(
                "risk_scores",
                filters={"corridor_id": corridor_id},
                order_by="computed_at",
                order_desc=True,
                limit=1,
            )

        logger.info(
            "Scenario context for %d: scenario=%s impact=%s risk=%s",
            scenario_id,
            {
                "id": scenario.get("id"),
                "name": scenario.get("name"),
                "corridor_id": scenario.get("corridor_id"),
                "disruption_pct": scenario.get("disruption_pct"),
                "transit_delay_days": scenario.get("transit_delay_days"),
            } if scenario else None,
            {
                "scenario_id": impact.get("scenario_id"),
                "refinery_run_rate": impact.get("refinery_run_rate"),
                "price_premium": impact.get("price_premium"),
                "spr_days_remaining": impact.get("spr_days_remaining"),
                "computed_at": impact.get("computed_at"),
            } if impact else None,
            {
                "corridor_id": corridor_id,
                "score": corridor_risk_rows[0].get("score") if corridor_risk_rows else None,
                "computed_at": corridor_risk_rows[0].get("computed_at") if corridor_risk_rows else None,
            } if corridor_id else None,
        )

        recommendations = run_procurement_orchestrator(scenario_id)
        reserve_plan = run_reserve_optimizer(scenario_id)
        return {
            "status": "ok",
            "recommendations": recommendations,
            "reserve_plan": reserve_plan,
        }
    except Exception as e:
        logger.exception("Endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scenarios/{scenario_id}/recommendations")
def get_recommendations(scenario_id: int):
    """Get the latest ranked recommendations for a scenario."""
    try:
        # Get the timestamp of the most recent recommendation
        latest = query_table(
            "recommendations",
            filters={"scenario_id": scenario_id},
            order_by="created_at",
            order_desc=True,
            limit=1
        )
        if not latest:
            return {"status": "ok", "recommendations": []}
            
        recent_time = latest[0]["created_at"]
        
        # Fetch the top 5 for that specific run
        rows = query_table(
            "recommendations",
            filters={"scenario_id": scenario_id, "created_at": recent_time},
            order_by="rank",
            order_desc=False,
            limit=5
        )
        return {"status": "ok", "recommendations": rows}
    except Exception as e:
        logger.warning(f"Failed to fetch recommendations (DB table missing?): {e}")
        return {"status": "ok", "recommendations": []}


@app.get("/api/scenarios/{scenario_id}/reserve_plan")
def get_reserve_plan(scenario_id: int):
    """Get the latest day-by-day SPR drawdown plan for a scenario."""
    try:
        # Get the timestamp of the most recent plan
        latest = query_table(
            "reserve_plans",
            filters={"scenario_id": scenario_id},
            order_by="created_at",
            order_desc=True,
            limit=1
        )
        if not latest:
            return {"status": "ok", "plan": []}
            
        recent_time = latest[0]["created_at"]
        
        rows = query_table(
            "reserve_plans",
            filters={"scenario_id": scenario_id, "created_at": recent_time},
            order_by="drawdown_day",
            order_desc=False
        )
        return {"status": "ok", "plan": rows}
    except Exception as e:
        logger.warning(f"Failed to fetch reserve plan (DB table missing?): {e}")
        return {"status": "ok", "plan": []}


# ─── Stage 4: Network Digital Twin ────────────────────────────────────────────

@app.get("/api/network/graph")
def api_network_graph():
    """Return the full network graph (nodes + edges + corridor origins)."""
    try:
        return {"status": "ok", **get_network_graph()}
    except Exception as e:
        logger.exception("Network graph endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/network/impact/{scenario_id}")
def api_network_impact(scenario_id: int):
    """Return the network graph annotated with scenario impact stress levels."""
    try:
        return {"status": "ok", **get_network_impact(scenario_id)}
    except Exception as e:
        logger.exception("Network impact endpoint failed:")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)
