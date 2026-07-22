import logging
from datetime import datetime, timezone
from typing import Optional
from google import genai

from config import GEMINI_API_KEY, GEMINI_MODEL
from database import query_table, insert_rows, get_latest_prices, get_latest_supplier_risk_scores

logger = logging.getLogger(__name__)

# Weights for the Procurement Scoring Algorithm
WEIGHTS = {
    "price": 0.35,
    "distance": 0.25,
    "tanker_availability": 0.15,
    "port_congestion": 0.15,
    "compatibility": 0.10
}

SUPPLIER_ROUTE_DEPENDENCIES = {
    "Saudi Arabia": ["hormuz"],
    "UAE": ["hormuz"],
    "Russia": ["red_sea"],
    "USA": [],
    "Nigeria": [],
}


def _get_latest_corridor_risk(corridor_id: Optional[str]) -> float:
    """
    Fetch the latest corridor risk score for the active scenario's disrupted route.
    """
    if not corridor_id:
        all_scores = []
        for cid in ["hormuz", "red_sea", "malacca"]:
            rows = query_table(
                "risk_scores",
                filters={"corridor_id": cid},
                order_by="computed_at",
                order_desc=True,
                limit=1,
            )
            if rows:
                all_scores.append(float(rows[0].get("score", 25)))
        return max(all_scores) if all_scores else 30.0

    rows = query_table(
        "risk_scores",
        filters={"corridor_id": corridor_id},
        order_by="computed_at",
        order_desc=True,
        limit=1,
    )
    if rows:
        return float(rows[0].get("score", 25))

    return {"hormuz": 35.0, "red_sea": 40.0, "malacca": 18.0}.get(corridor_id, 25.0)


def _route_exposure_for_supplier(country: str, corridor_id: Optional[str]) -> float:
    """
    Return how strongly a supplier route depends on the active disrupted corridor.
    """
    route_corridors = SUPPLIER_ROUTE_DEPENDENCIES.get(country, [])
    if not corridor_id:
        return 0.35 if route_corridors else 0.20
    if corridor_id in route_corridors:
        return 1.0
    return 0.15 if route_corridors else 0.05

def generate_procurement_rationale(top_supplier: dict, scenario_name: str) -> str:
    """
    Generate an LLM rationale for the #1 ranked procurement recommendation using Gemini.
    """
    if not GEMINI_API_KEY:
        return (
            f"Rule-based fallback: {top_supplier['source_country']} was ranked #1 due to a final score of "
            f"{top_supplier['final_score']:.1f}/100. It offers favorable metrics across price "
            f"({top_supplier['price_score']:.1f}), compatibility ({top_supplier['compatibility_score']:.1f}), "
            f"and availability ({top_supplier['tanker_availability_score']:.1f})."
        )

    prompt = f"""You are a senior energy procurement orchestrator for the Indian government.
We are responding to the disruption scenario: "{scenario_name}".

Our algorithm has ranked {top_supplier['source_country']} as the #1 alternative source country to increase crude oil imports from.
The algorithm evaluated 5 factors (0-100 scale, higher is better):
- Price Competitiveness: {top_supplier['price_score']:.1f}/100
- Distance & Geopolitical Risk: {top_supplier['distance_score']:.1f}/100
- Tanker Availability: {top_supplier['tanker_availability_score']:.1f}/100
- Port Congestion (India arrival): {top_supplier['port_congestion_score']:.1f}/100
- Refinery Compatibility: {top_supplier['compatibility_score']:.1f}/100
Final Score: {top_supplier['final_score']:.1f}/100

Write a 2-3 sentence strategic rationale for why {top_supplier['source_country']} is the best choice right now.
Synthesize the highest and lowest sub-scores logically.
Do NOT use bullet points — write in a direct, professional, and actionable prose style.
"""
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={"temperature": 0.4}
        )
        return response.text.strip()
    except Exception as e:
        logger.error("Gemini rationale generation failed: %s", e)
        return (
            f"{top_supplier['source_country']} represents the optimal immediate alternative, scoring "
            f"{top_supplier['final_score']:.1f}/100 overall. Its strong performance in price and availability "
            f"offsets any logistical or distance trade-offs given the current disruption."
        )

def run_procurement_orchestrator(scenario_id: int):
    """
    Computes procurement recommendations for 5 alternative suppliers based on 5 factors.
    Writes the ranked results to the `recommendations` table.
    """
    logger.info("Running Procurement Orchestrator for scenario_id=%d", scenario_id)
    
    # 1. Fetch Scenario Details
    try:
        scenarios = query_table("scenarios", filters={"id": scenario_id}, limit=1)
        scenario = scenarios[0] if scenarios else None
    except Exception:
        scenario = None
        
    if not scenario:
        from agents.scenario_engine import SCENARIO_TEMPLATES
        scenario = SCENARIO_TEMPLATES.get(scenario_id)
        if not scenario:
            raise ValueError(f"Scenario {scenario_id} not found.")

    corridor_id = scenario.get("corridor_id")
    scenario_disruption_pct = float(scenario.get("disruption_pct", 0.0))
    scenario_corridor_risk = _get_latest_corridor_risk(corridor_id)

    scenario_impact = None
    try:
        scenario_impacts = query_table(
            "scenario_impacts",
            filters={"scenario_id": scenario_id},
            order_by="computed_at",
            order_desc=True,
            limit=1,
        )
        scenario_impact = scenario_impacts[0] if scenario_impacts else None
    except Exception as e:
        logger.debug("Could not read scenario_impacts for scenario_id=%d: %s", scenario_id, e)

    logger.info(
        "Procurement input for scenario_id=%d: scenario=%s impact=%s corridor_risk=%s",
        scenario_id,
        {
            "name": scenario.get("name"),
            "corridor_id": corridor_id,
            "disruption_pct": scenario_disruption_pct,
            "transit_delay_days": scenario.get("transit_delay_days", 0),
        },
        {
            "refinery_run_rate": scenario_impact.get("refinery_run_rate") if scenario_impact else None,
            "price_premium": scenario_impact.get("price_premium") if scenario_impact else None,
            "spr_days_remaining": scenario_impact.get("spr_days_remaining") if scenario_impact else None,
            "computed_at": scenario_impact.get("computed_at") if scenario_impact else None,
        } if scenario_impact else None,
        {
            "corridor_id": corridor_id,
            "score": scenario_corridor_risk,
        },
    )
    
    # 2. Fetch Static Supplier Reference
    try:
        suppliers = query_table("supplier_reference")
    except Exception as e:
        logger.warning(f"Failed to fetch supplier_reference: {e}. Using fallback data.")
        suppliers = None

    if not suppliers:
        suppliers = [
            {"source_country": "Saudi Arabia", "commodity_benchmark": "Brent", "price_discount_premium": 1.50, "distance_risk_factor": 0.20, "tanker_availability_score": 0.90, "port_congestion_score": 0.30, "compatibility_score": 0.95},
            {"source_country": "USA", "commodity_benchmark": "WTI", "price_discount_premium": 0.00, "distance_risk_factor": 0.80, "tanker_availability_score": 0.70, "port_congestion_score": 0.20, "compatibility_score": 0.80},
            {"source_country": "Russia", "commodity_benchmark": "Brent", "price_discount_premium": -15.00, "distance_risk_factor": 0.60, "tanker_availability_score": 0.40, "port_congestion_score": 0.60, "compatibility_score": 0.85},
            {"source_country": "Nigeria", "commodity_benchmark": "Brent", "price_discount_premium": 2.00, "distance_risk_factor": 0.50, "tanker_availability_score": 0.60, "port_congestion_score": 0.40, "compatibility_score": 0.90},
            {"source_country": "UAE", "commodity_benchmark": "Brent", "price_discount_premium": 1.00, "distance_risk_factor": 0.25, "tanker_availability_score": 0.85, "port_congestion_score": 0.25, "compatibility_score": 0.90}
        ]

    # 3. Fetch Live Prices
    live_prices = get_latest_prices()
    price_map = {p["commodity"]: p["price"] for p in live_prices}
    brent_price = price_map.get("Brent", 80.0)
    wti_price = price_map.get("WTI", 75.0)

    # 4. Fetch Live Supplier Risk Scores
    risk_scores = get_latest_supplier_risk_scores()
    risk_map = {s["supplier_country"]: s["score"] for s in risk_scores}

    # 5. Compute scores for each supplier
    results = []
    for sup in suppliers:
        country = sup["source_country"]
        route_exposure = _route_exposure_for_supplier(country, corridor_id)
        
        # A. Price Score (0-100)
        benchmark = brent_price if sup["commodity_benchmark"] == "Brent" else wti_price
        discount_premium = float(sup["price_discount_premium"])
        actual_price = benchmark + discount_premium
        price_score = max(0.0, min(100.0, 100 - (actual_price - 60) * 2.5))
        
        # B. Distance & Risk Score (0-100)
        dist_factor = float(sup["distance_risk_factor"])
        live_risk = float(risk_map.get(country, 30.0))
        corridor_penalty = scenario_corridor_risk * route_exposure
        supplier_risk_penalty = live_risk * 0.25
        distance_risk_penalty = (dist_factor * 50) + supplier_risk_penalty + corridor_penalty
        distance_score = max(0.0, min(100.0, 100 - distance_risk_penalty))
        
        # C. Tanker Availability Score (0-100)
        tanker_score = float(sup["tanker_availability_score"]) * 100
        
        # D. Port Congestion Score (0-100)
        port_score = (1.0 - float(sup["port_congestion_score"])) * 100
        
        # E. Compatibility Score (0-100)
        compat_score = float(sup["compatibility_score"]) * 100
        
        # Final Weighted Score
        final_score = (
            price_score * WEIGHTS["price"] +
            distance_score * WEIGHTS["distance"] +
            tanker_score * WEIGHTS["tanker_availability"] +
            port_score * WEIGHTS["port_congestion"] +
            compat_score * WEIGHTS["compatibility"]
        )
        
        results.append({
            "source_country": country,
            "price_score": round(price_score, 2),
            "distance_score": round(distance_score, 2),
            "tanker_availability_score": round(tanker_score, 2),
            "port_congestion_score": round(port_score, 2),
            "compatibility_score": round(compat_score, 2),
            "final_score": round(final_score, 2),
            "route_exposure": round(route_exposure, 2),
            "corridor_penalty": round(corridor_penalty, 2),
        })

    # 6. Rank the results
    results.sort(key=lambda x: x["final_score"], reverse=True)
    for i, res in enumerate(results):
        res["rank"] = i + 1

    logger.info(
        "Procurement ranking for scenario_id=%d corridor=%s: %s",
        scenario_id,
        corridor_id,
        [
            {
                "rank": res["rank"],
                "source_country": res["source_country"],
                "distance_score": res["distance_score"],
                "final_score": res["final_score"],
                "route_exposure": res["route_exposure"],
                "corridor_penalty": res["corridor_penalty"],
            }
            for res in results
        ],
    )

    # 7. Generate LLM Rationale for #1
    rationale = generate_procurement_rationale(results[0], scenario["name"])
    results[0]["rationale"] = rationale

    # 8. Persist to DB
    insert_data = []
    created_at = datetime.now(timezone.utc).isoformat()
    for res in results:
        insert_data.append({
            "scenario_id": scenario_id,
            "source_country": res["source_country"],
            "rank": res["rank"],
            "price_score": res["price_score"],
            "distance_score": res["distance_score"],
            "tanker_availability_score": res["tanker_availability_score"],
            "port_congestion_score": res["port_congestion_score"],
            "compatibility_score": res["compatibility_score"],
            "final_score": res["final_score"],
            "rationale": res.get("rationale", None),
            "created_at": created_at
        })
    
    try:
        insert_rows("recommendations", insert_data)
        logger.info("Persisted %d recommendations for scenario_id=%d", len(insert_data), scenario_id)
    except Exception as e:
        logger.warning(f"Failed to persist recommendations (DB table missing?): {e}")
    
    return results
