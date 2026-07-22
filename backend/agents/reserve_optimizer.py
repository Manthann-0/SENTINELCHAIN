import logging
import re
from datetime import datetime, timezone

from database import query_table, insert_rows
from agents.scenario_engine import CURRENT_SPR_DAYS, DAILY_CONSUMPTION_MBPD, _compute_cascade, SCENARIO_TEMPLATES

logger = logging.getLogger(__name__)

# Constants
MIN_SPR_FLOOR_DAYS = 3.0  # Strategic minimum cover we will not breach

def run_reserve_optimizer(scenario_id: int):
    """
    Computes a day-by-day SPR drawdown plan over the disruption duration.
    Writes the timeline to the `reserve_plans` table.
    """
    logger.info("Running Reserve Optimizer for scenario_id=%d", scenario_id)
    
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

    # Use the compute_cascade logic to get the gap_volume_mbpd
    metrics = _compute_cascade(scenario)
    daily_gap_mbpd = metrics.get("gap_volume_mbpd", 0.0)

    # Parse duration from assumptions
    assumptions = scenario.get("assumptions", {})
    duration_str = assumptions.get("duration_assumption", "30 days")
    match = re.search(r'\d+', duration_str)
    duration_days = int(match.group()) if match else 30
    
    # In addition to the disruption duration, we add an estimated replenishment window.
    # We will assume a flat 15 days of transit/replenishment lag after the disruption clears.
    REPLENISHMENT_LAG_DAYS = 15
    total_plan_days = duration_days + REPLENISHMENT_LAG_DAYS

    current_spr_mbbls = CURRENT_SPR_DAYS * DAILY_CONSUMPTION_MBPD
    min_floor_mbbls = MIN_SPR_FLOOR_DAYS * DAILY_CONSUMPTION_MBPD
    
    plan_timeline = []
    created_at = datetime.now(timezone.utc).isoformat()
    
    # 2. Simulate day-by-day
    for day in range(1, total_plan_days + 1):
        # Determine if we are still in the gap phase or the lag phase
        # Both phases require SPR drawdown because normal flows haven't arrived yet.
        gap_today = daily_gap_mbpd
        
        # Calculate how much we can draw without breaching the floor
        available_to_draw = current_spr_mbbls - min_floor_mbbls
        
        actual_draw = 0.0
        if available_to_draw > 0:
            actual_draw = min(gap_today, available_to_draw)
        
        # Coverage: How much of the demand did we meet?
        # Total daily supply = (Normal supply - gap_today) + actual_draw
        normal_supply = DAILY_CONSUMPTION_MBPD
        supply_today = normal_supply - gap_today + actual_draw
        coverage_pct = (supply_today / normal_supply) * 100.0 if normal_supply > 0 else 100.0
        
        # Update SPR
        current_spr_mbbls -= actual_draw
        current_spr_days_remaining = current_spr_mbbls / DAILY_CONSUMPTION_MBPD
        spr_level_pct = (current_spr_mbbls / (CURRENT_SPR_DAYS * DAILY_CONSUMPTION_MBPD)) * 100.0
        
        plan_timeline.append({
            "scenario_id": scenario_id,
            "drawdown_day": day,
            "spr_level_pct": round(spr_level_pct, 2),
            "refinery_demand_covered_pct": round(coverage_pct, 2),
            "created_at": created_at
        })
        
    # 3. Persist to DB
    try:
        insert_rows("reserve_plans", plan_timeline)
        logger.info("Persisted %d days of reserve plans for scenario_id=%d", len(plan_timeline), scenario_id)
    except Exception as e:
        logger.warning(f"Failed to persist reserve plans (DB table missing?): {e}")
    
    return plan_timeline
