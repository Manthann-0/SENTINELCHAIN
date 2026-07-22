"""
SentinelChain — Risk Intelligence Agent
Uses Gemini API to analyze geopolitical events and produce a 0-100 disruption
risk score per shipping corridor with explainable justification.
"""

import logging
from json import dumps
from datetime import datetime, timezone
from typing import List

from google import genai
from pydantic import BaseModel, Field

from config import GEMINI_API_KEY, GEMINI_MODEL, CORRIDORS
from database import (
    query_recent_events,
    query_supplier_recent_events,
    query_table,
    insert_rows,
    get_latest_prices,
)
from vector_store import query_documents

logger = logging.getLogger(__name__)


def _gemini_error_details(error: Exception) -> dict:
    """Extract the fullest available Gemini error details for logging."""
    response = getattr(error, "response", None)
    status_code = (
        getattr(error, "status_code", None)
        or getattr(error, "code", None)
        or getattr(error, "status", None)
    )
    raw_body = None
    error_details = getattr(error, "details", None)

    if response is not None:
        status_code = status_code or getattr(response, "status_code", None) or getattr(response, "status", None)
        raw_body = getattr(response, "text", None)
        if raw_body is None:
            try:
                raw_body = response.json()
            except Exception:
                raw_body = None

    return {
        "message": str(error),
        "status_code": status_code,
        "raw_body": raw_body,
        "details": error_details,
        "args": getattr(error, "args", None),
        "error_type": error.__class__.__name__,
    }


def _log_gemini_failure(scope: str, scope_id: str, error: Exception, request_payload: dict) -> dict:
    """Log a complete Gemini failure payload and return structured diagnostics."""
    details = _gemini_error_details(error)
    logger.exception("Gemini API call failed for %s %s", scope, scope_id)
    logger.error(
        "Gemini failure details for %s %s: status_code=%s error_type=%s message=%s",
        scope,
        scope_id,
        details["status_code"],
        details["error_type"],
        details["message"],
    )
    if details["raw_body"] is not None:
        logger.error(
            "Gemini raw error body for %s %s: %s",
            scope,
            scope_id,
            details["raw_body"],
        )
    if details["details"] is not None:
        logger.error(
            "Gemini structured error details for %s %s: %s",
            scope,
            scope_id,
            details["details"],
        )
    logger.error(
        "Gemini exception args for %s %s: %s",
        scope,
        scope_id,
        details["args"],
    )
    logger.error(
        "Gemini request payload for %s %s: %s",
        scope,
        scope_id,
        dumps(request_payload, ensure_ascii=False),
    )
    return details

# ─── Pydantic Schema for Gemini Output ────────────────────────────────────────

class RiskAssessment(BaseModel):
    score: int = Field(description="Disruption risk score on a scale of 0 to 100.")
    justification: str = Field(description="A concise 2-3 sentence summary of the key risk drivers.")
    risk_drivers: List[str] = Field(description="Short bullet-style list of the key current data points driving the score.")

class SupplierRiskAssessment(BaseModel):
    score: int = Field(description="Disruption risk score on a scale of 0 to 100.")
    justification: str = Field(description="A concise 2-3 sentence summary of the key risk drivers.")

# ─── Client Setup ─────────────────────────────────────────────────────────────

def _get_gemini_client() -> genai.Client:
    """Create a Gemini client."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY must be set in .env")
    return genai.Client(api_key=GEMINI_API_KEY)


def _get_vessel_count(corridor_id: str) -> int:
    """Get the number of vessels currently tracked in a corridor."""
    vessels = query_table(
        "vessels",
        select="id",
        filters={"corridor_id": corridor_id},
    )
    return len(vessels)


def _get_sanctions_count() -> int:
    """Get total sanctions entities related to Iran/maritime."""
    sanctions = query_table("sanctions", select="id")
    return len(sanctions)


def _get_price_context() -> str:
    """Get a text summary of current oil prices."""
    prices = get_latest_prices()
    if not prices:
        return "Brent ~$82/bbl, WTI ~$78/bbl (fallback estimates)"
    
    parts = []
    for p in prices:
        parts.append(f"{p['commodity']}: ${p['price']}")
    return ", ".join(parts)


def score_corridor(corridor_id: str) -> dict:
    """
    Compute a risk score for a single corridor using Gemini.
    
    Flow:
    1. Fetch recent events (last 48h) from the events table
    2. Query Chroma for semantically relevant documents
    3. Gather context: vessel count, prices, sanctions
    4. Call Gemini to analyze and produce a structured Pydantic response
    5. Write result to risk_scores table
    
    Returns: {corridor_id, score, justification, event_analyses}
    """
    corridor = CORRIDORS.get(corridor_id)
    if not corridor:
        raise ValueError(f"Unknown corridor: {corridor_id}")

    logger.info("Scoring corridor: %s (%s)", corridor_id, corridor["name"])

    # 1. Get recent events
    events = query_recent_events(corridor_id, hours=48)
    logger.info("  Found %d recent events", len(events))

    # 2. Get semantically relevant documents from Chroma
    rag_query = f"disruption risk {corridor['name']} shipping crude oil"
    rag_results = query_documents(rag_query, n_results=5, corridor_id=corridor_id)
    rag_docs = rag_results.get("documents", [])
    logger.info("  Found %d RAG documents", len(rag_docs))

    # 3. Gather context
    vessel_count = _get_vessel_count(corridor_id)
    sanctions_count = _get_sanctions_count()
    price_context = _get_price_context()

    # 4. Build Gemini prompt
    event_text = ""
    if events:
        for i, evt in enumerate(events[:15], 1):  # Cap at 15 events
            event_text += f"  {i}. [{evt.get('event_at', 'N/A')}] {evt.get('headline', 'N/A')}\n"
    else:
        event_text = "  No recent events found in the last 48 hours.\n"

    rag_text = ""
    if rag_docs:
        for i, doc in enumerate(rag_docs[:5], 1):
            rag_text += f"  {i}. {doc}\n"

    system_instruction = """You are a senior geopolitical risk analyst specializing in maritime energy supply chains and Middle Eastern security affairs. You provide data-driven, objective risk assessments for crude oil shipping corridors critical to India's energy security.

Your analysis must be grounded in the provided data — do not hallucinate events or inflate risk without evidence. Scores should reflect actual signal density and severity.
"""

    user_prompt = f"""Analyze the current disruption risk for the **{corridor['name']}** shipping corridor.

## Context
- **Corridor significance:** {corridor['description']}
- **India's exposure:** {corridor['india_share_pct']*100:.0f}% of India's crude oil imports transit this corridor
- **Global flow:** ~{corridor['daily_flow_mbpd']} million barrels/day
- **Current oil prices:** {price_context}
- **Vessels currently tracked in corridor:** {vessel_count}
- **Active Iran/maritime sanctions entities:** {sanctions_count}

## Recent Events (Last 48 Hours)
{event_text}

## Additional Intelligence (RAG-retrieved context)
{rag_text if rag_text else "  No additional context available."}

## Instructions
Based on the above data, produce a risk assessment. Be precise — a score of 0 means no credible threat; 100 means imminent complete closure.

Most corridors under normal conditions score 15-35. Elevated tension pushes to 40-65. Active military conflict or blockade pushes 70-100.

If there are no recent events, default to a baseline score of 15-25 based on structural risk factors.

Return risk_drivers as short strings grounded only in the provided recent events, RAG context, vessel count, sanctions count, and price context.
"""

    request_payload = {
        "model": GEMINI_MODEL,
        "contents": user_prompt,
        "config": {
            "system_instruction": system_instruction,
            "response_mime_type": "application/json",
            "response_schema": "RiskAssessment",
            "temperature": 0.2,
        },
        "event_count": len(events),
        "rag_doc_count": len(rag_docs),
        "corridor_id": corridor_id,
    }
    logger.info(
        "Gemini request metadata for corridor %s: model=%s events=%d rag_docs=%d key_present=%s",
        corridor_id,
        GEMINI_MODEL,
        len(events),
        len(rag_docs),
        bool(GEMINI_API_KEY),
    )
    logger.info(
        "Gemini request body for corridor %s: %s",
        corridor_id,
        dumps(request_payload, ensure_ascii=False),
    )

    # 5. Call Gemini
    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_schema": RiskAssessment,
                "temperature": 0.2, # Low temperature for analytical tasks
            },
        )
        logger.info("Gemini raw response for corridor %s: %s", corridor_id, getattr(response, "text", None))
        # 6. Parse structured response
        parsed: RiskAssessment = response.parsed
        if not parsed:
            raise ValueError("Gemini returned empty parsed response")
            
        score = min(100, max(0, parsed.score))
        justification = parsed.justification
        
        event_analyses = [{"headline": driver} for driver in parsed.risk_drivers]
        risk_drivers = parsed.risk_drivers
        analysis_status = "ok"
        analysis_error = None
        analysis_status_code = None
        
    except Exception as e:
        details = _log_gemini_failure("corridor", corridor_id, e, request_payload)
        # Return a baseline score on API failure
        baseline = _baseline_score(corridor_id)
        baseline.update({
            "analysis_status": "unavailable",
            "analysis_error": details["message"],
            "analysis_status_code": details["status_code"],
            "analysis_model": GEMINI_MODEL,
        })
        return baseline

    # 7. Write to risk_scores table
    try:
        insert_rows("risk_scores", [{
            "corridor_id": corridor_id,
            "score": score,
            "source_summary": justification,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }])
        logger.info("  Score for %s: %d — %s", corridor_id, score, justification[:80])
    except Exception as e:
        logger.error("Failed to write risk score: %s", e)

    return {
        "corridor_id": corridor_id,
        "corridor_name": corridor["name"],
        "score": score,
        "justification": justification,
        "event_analyses": event_analyses,
        "risk_drivers": risk_drivers,
        "events_analyzed": len(events),
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "analysis_status": analysis_status,
        "analysis_error": analysis_error,
        "analysis_status_code": analysis_status_code,
        "analysis_model": GEMINI_MODEL,
    }


def _baseline_score(corridor_id: str) -> dict:
    """Return a baseline risk score when Gemini is unavailable."""
    baselines = {"hormuz": 35, "red_sea": 40, "malacca": 18}
    score = baselines.get(corridor_id, 25)
    justification = (
        f"Baseline structural risk for {CORRIDORS[corridor_id]['name']}. "
        f"Gemini API was unavailable for real-time analysis."
    )
    
    try:
        insert_rows("risk_scores", [{
            "corridor_id": corridor_id,
            "score": score,
            "source_summary": justification,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }])
    except Exception as e:
        logger.error("Failed to write baseline risk score for %s: %s", corridor_id, e)

    return {
        "corridor_id": corridor_id,
        "corridor_name": CORRIDORS[corridor_id]["name"],
        "score": score,
        "justification": justification,
        "event_analyses": [],
        "risk_drivers": [],
        "events_analyzed": 0,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "analysis_status": "unavailable",
        "analysis_error": None,
        "analysis_status_code": None,
        "analysis_model": GEMINI_MODEL,
    }


def score_all_corridors() -> list[dict]:
    """Score all three corridors and return results."""
    results = []
    for corridor_id in CORRIDORS:
        try:
            result = score_corridor(corridor_id)
            results.append(result)
        except Exception as e:
            logger.error("Failed to score %s: %s", corridor_id, e)
            results.append(_baseline_score(corridor_id))
    return results


def score_supplier(supplier: str) -> dict:
    """
    Compute a risk score for a single supplier using Gemini.
    """
    print(f"\n\n==================\nSUPPLIER SCORING FUNCTION CALLED for {supplier}\n==================")
    from config import SUPPLIERS
    supplier_info = SUPPLIERS.get(supplier)
    if not supplier_info:
        raise ValueError(f"Unknown supplier: {supplier}")

    logger.info("Scoring supplier: %s", supplier)

    # 1. Get recent events mentioning the supplier
    events = query_supplier_recent_events(supplier, hours=48)
    print(f"STEP 3 - EVENT COUNT: Matching events found for {supplier}: {len(events)}")
    logger.info("  Found %d recent events", len(events))

    # 2. Get sanctions context for this supplier
    sanctions_count = len(query_table("sanctions", select="id", filters={"country": supplier}))
    print(f"STEP 3 - SANCTIONS COUNT: Matching sanctions entries for {supplier}: {sanctions_count}")
    logger.info("  Found %d sanctions rows for %s", sanctions_count, supplier)

    baseline_score = max(15, min(35, 15 + (sanctions_count * 3) + min(len(events), 10)))
    logger.info("  Baseline floor for %s: %d", supplier, baseline_score)
    
    # 3. Get price context
    price_context = _get_price_context()

    # 4. Build Gemini prompt
    event_text = ""
    if events:
        for i, evt in enumerate(events[:15], 1):
            event_text += f"  {i}. [{evt.get('event_at', 'N/A')}] {evt.get('headline', 'N/A')}\n"
    else:
        event_text = "  No recent events found in the last 48 hours.\n"

    system_instruction = """You are a senior geopolitical risk analyst specializing in energy supply chains. You provide objective risk assessments for major crude oil supplier countries.
Your analysis must be grounded in the provided data. Scores should reflect actual export disruption or production cut signals."""

    user_prompt = f"""Analyze the current crude oil supply disruption risk for **{supplier}**.

## Context
- **Benchmark Grade:** {supplier_info['benchmark']}
- **Current oil prices:** {price_context}
- **Active Sanctions against {supplier}:** {sanctions_count} entities

## Recent Events (Last 48 Hours)
{event_text}

## Instructions
Produce a disruption risk assessment for this supplier (0 to 100).
A score of 0 means stable export capacity; 100 means total export blockade or halt.
If there are no recent events and no massive sanctions, default to a baseline score of 10-25 depending on structural risk.
"""

    request_payload = {
        "model": GEMINI_MODEL,
        "contents": user_prompt,
        "config": {
            "system_instruction": system_instruction,
            "response_mime_type": "application/json",
            "response_schema": "SupplierRiskAssessment",
            "temperature": 0.2,
        },
        "event_count": len(events),
        "supplier": supplier,
    }
    logger.info(
        "Gemini request metadata for supplier %s: model=%s events=%d key_present=%s",
        supplier,
        GEMINI_MODEL,
        len(events),
        bool(GEMINI_API_KEY),
    )
    logger.info(
        "Gemini request body for supplier %s: %s",
        supplier,
        dumps(request_payload, ensure_ascii=False),
    )

    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "response_schema": SupplierRiskAssessment,
                "temperature": 0.2,
            },
        )
        print(f"STEP 3 - RAW API RESPONSE for {supplier}:\n{response.text}")
        parsed: SupplierRiskAssessment = response.parsed
        if not parsed:
            raise ValueError("Gemini returned empty parsed response")

        score = min(100, max(baseline_score, parsed.score))
        justification = parsed.justification
        analysis_status = "ok"
        analysis_error = None
        analysis_status_code = None
        
    except Exception as e:
        details = _log_gemini_failure("supplier", supplier, e, request_payload)
        print(f"STEP 3 - API FAILED for {supplier}: {details['message']}")
        score = baseline_score
        justification = f"Baseline risk for {supplier} (Gemini API unavailable or analysis unavailable)."
        analysis_status = "unavailable"
        analysis_error = details["message"]
        analysis_status_code = details["status_code"]

    # Write to supplier_risk_scores
    print(f"STEP 3 - SCORE TO WRITE: Final score about to be written for {supplier}: {score}")
    try:
        insert_rows("supplier_risk_scores", [{
            "supplier_country": supplier,
            "score": score,
            "source_summary": justification,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }])
        logger.info("  Score for %s: %d — %s", supplier, score, justification[:80])
    except Exception as e:
        logger.error("Failed to write supplier risk score: %s", e)

    return {
        "supplier_country": supplier,
        "score": score,
        "justification": justification,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "analysis_status": analysis_status,
        "analysis_error": analysis_error,
        "analysis_status_code": analysis_status_code,
        "analysis_model": GEMINI_MODEL,
    }


def score_all_suppliers() -> list[dict]:
    """Score all top 5 suppliers and return results."""
    from config import SUPPLIERS
    logger.info("Scoring all suppliers: %s", ", ".join(SUPPLIERS.keys()))
    results = []
    for supplier in SUPPLIERS.keys():
        try:
            result = score_supplier(supplier)
            results.append(result)
        except Exception as e:
            logger.error("Failed to score supplier %s: %s", supplier, e)
    logger.info("Completed supplier scoring pass with %d results", len(results))
    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = score_all_corridors()
    for r in results:
        print(f"\n{r['corridor_name']}: {r['score']}/100")
        print(f"  {r['justification']}")
