-- ============================================================================
-- SentinelChain — Database Migration (Supabase Postgres)
-- Run this in the Supabase SQL Editor to create all Stage 1 + Stage 2 tables.
-- ============================================================================

-- Risk scores per corridor, computed by the Risk Intelligence Agent
CREATE TABLE IF NOT EXISTS risk_scores (
    id          SERIAL PRIMARY KEY,
    corridor_id TEXT NOT NULL,
    score       NUMERIC(5,2) NOT NULL,
    source_summary TEXT,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_corridor
    ON risk_scores (corridor_id, computed_at DESC);

-- Commodity prices (Brent/WTI) from EIA
CREATE TABLE IF NOT EXISTS prices (
    id          SERIAL PRIMARY KEY,
    commodity   TEXT NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    source      TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prices_commodity
    ON prices (commodity, recorded_at DESC);

-- Vessel positions from AIS data
CREATE TABLE IF NOT EXISTS vessels (
    id          SERIAL PRIMARY KEY,
    vessel_id   TEXT NOT NULL,
    lat         NUMERIC(9,6),
    lon         NUMERIC(9,6),
    corridor_id TEXT,
    status      TEXT,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vessels_corridor
    ON vessels (corridor_id, snapshot_at DESC);

-- Sanctions entities from OFAC SDN list
CREATE TABLE IF NOT EXISTS sanctions (
    id          SERIAL PRIMARY KEY,
    entity_name TEXT NOT NULL,
    country     TEXT,
    category    TEXT,
    date_added  DATE
);

CREATE INDEX IF NOT EXISTS idx_sanctions_country
    ON sanctions (country);

-- Geopolitical events/headlines from GDELT + NewsAPI
CREATE TABLE IF NOT EXISTS events (
    id          SERIAL PRIMARY KEY,
    headline    TEXT NOT NULL,
    corridor_id TEXT,
    sentiment   NUMERIC(3,2),
    severity    NUMERIC(3,2),
    url         TEXT,
    event_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_corridor
    ON events (corridor_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_url
    ON events (url);

-- ============================================================================
-- STAGE 2: Scenario Simulator Tables
-- ============================================================================

-- Scenario templates (3 hardcoded seeds defined below)
CREATE TABLE IF NOT EXISTS scenarios (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    corridor_id     TEXT,                         -- Affected corridor (null = global)
    disruption_pct  NUMERIC(5,2) NOT NULL,        -- 0.0–1.0 fraction of corridor disrupted
    transit_delay_days INTEGER DEFAULT 0,         -- Extra days added by rerouting
    assumptions     JSONB,                        -- Full set of parameters as JSON
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Cascade impact results computed by the scenario engine
CREATE TABLE IF NOT EXISTS scenario_impacts (
    id                  SERIAL PRIMARY KEY,
    scenario_id         INT REFERENCES scenarios(id) ON DELETE CASCADE,
    refinery_run_rate   NUMERIC(5,2),   -- Percentage (e.g. 78.5)
    price_premium       NUMERIC(6,2),   -- USD/bbl above baseline
    spr_days_remaining  NUMERIC(5,1),   -- Days of SPR cover after gap
    narrative           TEXT,           -- LLM-generated plain-English summary
    sources             JSONB,          -- Array of cited source URLs from RAG
    computed_at         TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_impacts_scenario
    ON scenario_impacts (scenario_id, computed_at DESC);

-- ── Seed Data: 3 Hardcoded Scenario Templates ────────────────────────────────
-- Disruption percentages are expressed as fractions (0.0–1.0)

INSERT INTO scenarios (id, name, corridor_id, disruption_pct, transit_delay_days, assumptions)
VALUES
  (1,
   'Hormuz Partial Closure',
   'hormuz',
   0.40,
   0,
   '{
     "trigger": "Iranian IRGC mines or blockades 40% of Hormuz tanker lanes",
     "affected_volume_mbpd": 8.2,
     "india_import_hit_pct": 0.42,
     "duration_assumption": "30 days",
     "source": "IEA Chokepoints Report 2023"
   }'::jsonb),

  (2,
   'Red Sea Shipping Suspension',
   'red_sea',
   1.00,
   14,
   '{
     "trigger": "100% Bab-el-Mandeb rerouting via Cape of Good Hope due to Houthi threat",
     "affected_volume_mbpd": 8.8,
     "india_import_hit_pct": 0.12,
     "duration_assumption": "60 days",
     "extra_transit_days": 14,
     "extra_cost_per_voyage_musd": 1.5,
     "source": "BIMCO / Clarksons Shipping Intelligence 2024"
   }'::jsonb),

  (3,
   'OPEC+ Emergency Production Cut',
   NULL,
   0.05,
   0,
   '{
     "trigger": "OPEC+ announces 5% emergency production cut (≈2.5 mbpd global reduction)",
     "affected_volume_mbpd": 2.5,
     "india_import_hit_pct": 0.30,
     "duration_assumption": "90 days",
     "source": "OPEC Monthly Oil Market Report baseline"
   }'::jsonb)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- EXTENSION: Supplier Risk Scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_risk_scores (
    id SERIAL PRIMARY KEY,
    supplier_country TEXT NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    source_summary TEXT,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_risk_country 
    ON supplier_risk_scores(supplier_country, computed_at DESC);

-- ============================================================================
-- STAGE 2 EXTENSION: Macro-Economic Impacts
-- ============================================================================

ALTER TABLE scenario_impacts ADD COLUMN IF NOT EXISTS power_sector_stress NUMERIC(5,2);
ALTER TABLE scenario_impacts ADD COLUMN IF NOT EXISTS gdp_impact_pct NUMERIC(5,2);

-- ============================================================================
-- STAGE 3: Procurement & Strategic Reserves
-- ============================================================================

-- Static reference table for alternative source countries
CREATE TABLE IF NOT EXISTS supplier_reference (
    id SERIAL PRIMARY KEY,
    source_country TEXT UNIQUE NOT NULL,
    commodity_benchmark TEXT NOT NULL,          -- e.g., 'Brent', 'WTI', 'Urals'
    price_discount_premium NUMERIC(5,2),        -- Constant +/- to benchmark price
    distance_risk_factor NUMERIC(5,2),          -- 0.0-1.0 (higher = worse/farther)
    tanker_availability_score NUMERIC(5,2),     -- 0.0-1.0 (higher = better availability)
    port_congestion_score NUMERIC(5,2),         -- 0.0-1.0 (higher = worse congestion)
    compatibility_score NUMERIC(5,2)            -- 0.0-1.0 (higher = better refinery match)
);

-- Seed data for 5 suppliers
INSERT INTO supplier_reference (source_country, commodity_benchmark, price_discount_premium, distance_risk_factor, tanker_availability_score, port_congestion_score, compatibility_score)
VALUES
  ('Saudi Arabia', 'Brent', 1.50, 0.20, 0.90, 0.30, 0.95),
  ('USA', 'WTI', 0.00, 0.80, 0.70, 0.20, 0.80),
  ('Russia', 'Brent', -15.00, 0.60, 0.40, 0.60, 0.85),
  ('Nigeria', 'Brent', 2.00, 0.50, 0.60, 0.40, 0.90),
  ('UAE', 'Brent', 1.00, 0.25, 0.85, 0.25, 0.90)
ON CONFLICT (source_country) DO NOTHING;

-- Procurement Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id SERIAL PRIMARY KEY,
    scenario_id INT REFERENCES scenarios(id) ON DELETE CASCADE,
    source_country TEXT NOT NULL,
    rank INT,
    price_score NUMERIC(5,2),
    distance_score NUMERIC(5,2),
    tanker_availability_score NUMERIC(5,2),
    port_congestion_score NUMERIC(5,2),
    compatibility_score NUMERIC(5,2),
    final_score NUMERIC(5,2),
    rationale TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_scenario
    ON recommendations (scenario_id, created_at DESC);

-- Strategic Reserve Optimisation Plans
CREATE TABLE IF NOT EXISTS reserve_plans (
    id SERIAL PRIMARY KEY,
    scenario_id INT REFERENCES scenarios(id) ON DELETE CASCADE,
    drawdown_day INT,
    spr_level_pct NUMERIC(5,2),
    refinery_demand_covered_pct NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reserve_plans_scenario
    ON reserve_plans (scenario_id, created_at DESC);
