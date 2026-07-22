"""
SentinelChain — Stage 4: Network Graph (Digital Twin)
=====================================================
Provides the geospatial network graph representing India's crude oil
supply chain: import terminals → refineries → distribution hubs.

This is a VISUALIZATION layer over the existing cascade math from Stage 2.
It does NOT introduce new prediction models — it propagates the scenario_impacts
metrics (refinery_run_rate, disruption_pct) along the network topology so the
map can color-code stress levels.

SEED DATA SOURCES:
  - Terminal/refinery locations: publicly available approximate lat/lon
    from MoPNG Annual Report 2022-23, company filings, Wikipedia
  - Capacity figures: illustrative, rounded from public PPAC data
  - Distribution hubs: simplified regional aggregation (not real pipeline endpoints)
"""

import logging
from typing import Optional

from database import query_table
from agents.scenario_engine import SCENARIO_TEMPLATES, _compute_cascade
from config import CORRIDORS

logger = logging.getLogger(__name__)

# ─── Hardcoded Network Seed Data ──────────────────────────────────────────────
# Used as fallback when DB tables don't exist yet.
# node_type: 'import_terminal' | 'refinery' | 'distribution_hub'

NETWORK_NODES = [
    # Import Terminals (where crude arrives by sea)
    {"id": 1, "node_type": "import_terminal", "name": "Vadinar Terminal",
     "lat": 22.3700, "lon": 69.7200, "capacity_bpd": 1400000,
     "corridor_id": "hormuz", "region": "West"},
    {"id": 2, "node_type": "import_terminal", "name": "Sikka / JNPT Terminal",
     "lat": 18.9500, "lon": 72.9500, "capacity_bpd": 900000,
     "corridor_id": "hormuz", "region": "West"},
    {"id": 3, "node_type": "import_terminal", "name": "Paradip Port Terminal",
     "lat": 20.2660, "lon": 86.6690, "capacity_bpd": 600000,
     "corridor_id": "red_sea", "region": "East"},
    {"id": 4, "node_type": "import_terminal", "name": "Vizag (Visakhapatnam) Terminal",
     "lat": 17.6868, "lon": 83.2185, "capacity_bpd": 500000,
     "corridor_id": "malacca", "region": "South-East"},

    # Refineries
    {"id": 5, "node_type": "refinery", "name": "Jamnagar Refinery (RIL)",
     "lat": 22.4700, "lon": 70.0500, "capacity_bpd": 1360000,
     "corridor_id": None, "region": "West"},
    {"id": 6, "node_type": "refinery", "name": "Mumbai Refinery (BPCL)",
     "lat": 19.0000, "lon": 72.8500, "capacity_bpd": 240000,
     "corridor_id": None, "region": "West"},
    {"id": 7, "node_type": "refinery", "name": "Paradip Refinery (IOC)",
     "lat": 20.3000, "lon": 86.6200, "capacity_bpd": 300000,
     "corridor_id": None, "region": "East"},
    {"id": 8, "node_type": "refinery", "name": "Vizag Refinery (HPCL)",
     "lat": 17.7200, "lon": 83.3000, "capacity_bpd": 166000,
     "corridor_id": None, "region": "South-East"},

    # Distribution Hubs (simplified regional aggregation)
    {"id": 9, "node_type": "distribution_hub", "name": "Western Distribution Hub",
     "lat": 23.0200, "lon": 72.5700, "capacity_bpd": 800000,
     "corridor_id": None, "region": "West"},
    {"id": 10, "node_type": "distribution_hub", "name": "Southern Distribution Hub",
     "lat": 13.0827, "lon": 80.2707, "capacity_bpd": 400000,
     "corridor_id": None, "region": "South"},
    {"id": 11, "node_type": "distribution_hub", "name": "Eastern Distribution Hub",
     "lat": 22.5726, "lon": 88.3639, "capacity_bpd": 350000,
     "corridor_id": None, "region": "East"},
    {"id": 12, "node_type": "distribution_hub", "name": "Northern Distribution Hub",
     "lat": 28.6139, "lon": 77.2090, "capacity_bpd": 600000,
     "corridor_id": None, "region": "North"},
]

# edge_type: 'shipping_route' | 'pipeline' | 'distribution_link'
NETWORK_EDGES = [
    # Shipping routes: corridor → import terminal
    {"id": 1, "source_node_id": None, "target_node_id": 1, "corridor_id": "hormuz",
     "flow_volume_bpd": 1200000, "edge_type": "shipping_route",
     "label": "Persian Gulf → Vadinar"},
    {"id": 2, "source_node_id": None, "target_node_id": 2, "corridor_id": "hormuz",
     "flow_volume_bpd": 800000, "edge_type": "shipping_route",
     "label": "Persian Gulf → JNPT"},
    {"id": 3, "source_node_id": None, "target_node_id": 3, "corridor_id": "red_sea",
     "flow_volume_bpd": 500000, "edge_type": "shipping_route",
     "label": "Red Sea/Suez → Paradip"},
    {"id": 4, "source_node_id": None, "target_node_id": 4, "corridor_id": "malacca",
     "flow_volume_bpd": 400000, "edge_type": "shipping_route",
     "label": "Malacca → Vizag"},

    # Pipelines: import terminal → refinery
    {"id": 5, "source_node_id": 1, "target_node_id": 5, "corridor_id": None,
     "flow_volume_bpd": 1300000, "edge_type": "pipeline",
     "label": "Vadinar → Jamnagar"},
    {"id": 6, "source_node_id": 2, "target_node_id": 6, "corridor_id": None,
     "flow_volume_bpd": 240000, "edge_type": "pipeline",
     "label": "JNPT → Mumbai BPCL"},
    {"id": 7, "source_node_id": 3, "target_node_id": 7, "corridor_id": None,
     "flow_volume_bpd": 300000, "edge_type": "pipeline",
     "label": "Paradip Port → Paradip IOC"},
    {"id": 8, "source_node_id": 4, "target_node_id": 8, "corridor_id": None,
     "flow_volume_bpd": 166000, "edge_type": "pipeline",
     "label": "Vizag Port → Vizag HPCL"},

    # Distribution links: refinery → distribution hub
    {"id": 9, "source_node_id": 5, "target_node_id": 9, "corridor_id": None,
     "flow_volume_bpd": 700000, "edge_type": "distribution_link",
     "label": "Jamnagar → Western Hub"},
    {"id": 10, "source_node_id": 5, "target_node_id": 12, "corridor_id": None,
     "flow_volume_bpd": 400000, "edge_type": "distribution_link",
     "label": "Jamnagar → Northern Hub"},
    {"id": 11, "source_node_id": 6, "target_node_id": 10, "corridor_id": None,
     "flow_volume_bpd": 200000, "edge_type": "distribution_link",
     "label": "Mumbai BPCL → Southern Hub"},
    {"id": 12, "source_node_id": 7, "target_node_id": 11, "corridor_id": None,
     "flow_volume_bpd": 250000, "edge_type": "distribution_link",
     "label": "Paradip IOC → Eastern Hub"},
    {"id": 13, "source_node_id": 8, "target_node_id": 10, "corridor_id": None,
     "flow_volume_bpd": 120000, "edge_type": "distribution_link",
     "label": "Vizag HPCL → Southern Hub"},
    {"id": 14, "source_node_id": 7, "target_node_id": 12, "corridor_id": None,
     "flow_volume_bpd": 50000, "edge_type": "distribution_link",
     "label": "Paradip IOC → Northern Hub"},
]

# Corridor origin points (for drawing shipping route lines on the map)
CORRIDOR_ORIGINS = {
    "hormuz": {"lat": 26.5, "lon": 56.5, "name": "Strait of Hormuz"},
    "red_sea": {"lat": 12.5, "lon": 43.5, "name": "Bab-el-Mandeb"},
    "malacca": {"lat": 2.5, "lon": 101.5, "name": "Strait of Malacca"},
}


def get_network_graph() -> dict:
    """
    Returns the full network graph (nodes + edges) with corridor origin points.
    Falls back to hardcoded seed data if DB tables don't exist.
    """
    try:
        nodes = query_table("network_nodes", order_by="id", order_desc=False)
        edges = query_table("network_edges", order_by="id", order_desc=False)
        if nodes and edges:
            return {
                "nodes": nodes,
                "edges": edges,
                "corridor_origins": CORRIDOR_ORIGINS,
            }
    except Exception as e:
        logger.warning("DB network tables not found (%s), using fallback seed data.", e)

    return {
        "nodes": NETWORK_NODES,
        "edges": NETWORK_EDGES,
        "corridor_origins": CORRIDOR_ORIGINS,
    }


def get_network_impact(scenario_id: int) -> dict:
    """
    Given a scenario, propagate the cascade impact across the network graph.
    
    This is a VISUALIZATION of the existing Stage 2 cascade math:
    - Import terminals fed by the disrupted corridor → reduced inflow
    - Connected refineries → refinery_run_rate from scenario_impacts
    - Downstream distribution hubs → derived stress indicator
    
    Returns the same graph structure but with stress_level annotations on each node/edge.
    """
    # 1. Get the scenario
    try:
        scenarios = query_table("scenarios", filters={"id": scenario_id}, limit=1)
        scenario = scenarios[0] if scenarios else None
    except Exception:
        scenario = None
    
    if not scenario:
        scenario = SCENARIO_TEMPLATES.get(scenario_id)
        if not scenario:
            return get_network_graph()  # Fallback: return normal graph
    
    # 2. Get the cascade metrics
    metrics = _compute_cascade(scenario)
    disruption_pct = float(scenario.get("disruption_pct", 0))
    corridor_id = scenario.get("corridor_id")
    refinery_run_rate = metrics.get("refinery_run_rate", 95.0)
    
    # 3. Annotate nodes with stress levels
    graph = get_network_graph()
    annotated_nodes = []
    
    for node in graph["nodes"]:
        stress = 0.0  # 0 = normal, 100 = fully disrupted
        status = "normal"
        
        if node["node_type"] == "import_terminal":
            # Terminals fed by the disrupted corridor are directly impacted
            if node.get("corridor_id") == corridor_id:
                stress = disruption_pct * 100
                status = "disrupted" if stress > 50 else "stressed"
            elif corridor_id is None:
                # OPEC+ cut affects all terminals proportionally
                stress = disruption_pct * 100 * 0.3  # dampened global effect
                status = "stressed" if stress > 10 else "normal"
        
        elif node["node_type"] == "refinery":
            # Refineries: use the run-rate drop from cascade engine
            # Stress = how far below 95% baseline the run-rate has fallen
            rate_drop = 95.0 - refinery_run_rate
            # Only refineries connected to disrupted terminals are affected
            # Find if any edge connects a disrupted terminal to this refinery
            connected_to_disrupted = False
            for edge in graph["edges"]:
                if edge.get("target_node_id") == node["id"] and edge.get("edge_type") == "pipeline":
                    source_terminal = next(
                        (n for n in graph["nodes"] if n["id"] == edge.get("source_node_id")), None
                    )
                    if source_terminal and source_terminal.get("corridor_id") == corridor_id:
                        connected_to_disrupted = True
                        break
                    elif corridor_id is None:
                        connected_to_disrupted = True
                        break
            
            if connected_to_disrupted:
                stress = min(100, rate_drop * 3)  # Scale for visual impact
                status = "disrupted" if stress > 40 else ("stressed" if stress > 10 else "normal")
            else:
                stress = rate_drop * 0.5  # Mild knock-on
                status = "stressed" if stress > 10 else "normal"
        
        elif node["node_type"] == "distribution_hub":
            # Hubs: derive from upstream refinery stress
            upstream_stress = []
            for edge in graph["edges"]:
                if edge.get("target_node_id") == node["id"] and edge.get("edge_type") == "distribution_link":
                    src_node = next(
                        (n for n in annotated_nodes if n["id"] == edge.get("source_node_id")), None
                    )
                    if src_node:
                        upstream_stress.append(src_node.get("stress", 0))
            
            if upstream_stress:
                stress = sum(upstream_stress) / len(upstream_stress) * 0.7  # dampened
            status = "stressed" if stress > 15 else "normal"
        
        annotated_nodes.append({
            **node,
            "stress": round(stress, 1),
            "status": status,
        })
    
    # 4. Annotate edges
    annotated_edges = []
    for edge in graph["edges"]:
        edge_stress = 0.0
        edge_status = "normal"
        
        if edge["edge_type"] == "shipping_route" and edge.get("corridor_id") == corridor_id:
            edge_stress = disruption_pct * 100
            edge_status = "disrupted" if edge_stress > 50 else "stressed"
        elif edge["edge_type"] == "shipping_route" and corridor_id is None:
            edge_stress = disruption_pct * 100 * 0.3
            edge_status = "stressed" if edge_stress > 10 else "normal"
        elif edge["edge_type"] in ("pipeline", "distribution_link"):
            # Derive from target node stress
            target = next((n for n in annotated_nodes if n["id"] == edge.get("target_node_id")), None)
            if target:
                edge_stress = target.get("stress", 0) * 0.8
                edge_status = target.get("status", "normal")
        
        annotated_edges.append({
            **edge,
            "stress": round(edge_stress, 1),
            "status": edge_status,
        })
    
    return {
        "nodes": annotated_nodes,
        "edges": annotated_edges,
        "corridor_origins": CORRIDOR_ORIGINS,
        "scenario": {
            "id": scenario_id,
            "name": scenario.get("name", ""),
            "corridor_id": corridor_id,
            "disruption_pct": disruption_pct,
            "refinery_run_rate": refinery_run_rate,
        },
    }
