# SentinelChain — PROGRESS.md

## Current Stage
**Stage 4** — Digital Twin Network Graph, Unified Dashboard, and Polish

## Completed

### Backend Foundation
- [x] `backend/config.py` — env vars, corridor definitions, keyword sets
- [x] `backend/database.py` — Supabase client singleton with typed helpers
- [x] `backend/vector_store.py` — Chroma PersistentClient
- [x] `backend/db/migration.sql` — DB schema + indexes
- [x] `backend/requirements.txt` — all Python deps pinned
- [x] `backend/.env.example` — template for API keys

### Ingestion Pipeline
- [x] GDELT, NewsAPI, EIA Prices, AIS Vessels, OFAC Sanctions → Supabase + Chroma
- [x] `backend/ingestion/run_all.py` — orchestrator runs all 5 in sequence

### Risk Intelligence Agent
- [x] `backend/agents/risk_intelligence.py` — Gemini-powered scoring per corridor and supplier
- [x] Baseline fallback scores when Gemini API unavailable

### Scenario Modeller & Cascade Engine
- [x] `backend/agents/scenario_engine.py` — 5-metric cascade impact engine
- [x] `backend/agents/procurement_orchestrator.py` — 5-factor supplier ranking
- [x] `backend/agents/reserve_optimizer.py` — SPR drawdown scheduling
- [x] Robust fallback mechanisms if DB tables are empty/missing

### Network Digital Twin (Stage 4)
- [x] `backend/agents/network_graph.py` — 12-node, 14-edge supply chain graph
- [x] **Impact Propagation** — Visualizes cascade math by computing stress levels on downstream nodes when an import terminal is disrupted
- [x] `GET /api/network/graph` and `GET /api/network/impact/{id}` endpoints

### Frontend Dashboard
- [x] **Unified Layout** — 4 guided sections (Live Risk → Network Twin → Simulator → Procurement)
- [x] **NetworkMap** — SVG-based interactive digital twin with impact visualization (no Mapbox key needed)
- [x] **ArchitectureDiagram** — Clean, theme-matched SVG component showing the data flow
- [x] **HowThisWorks** — Expandable panel explaining live vs illustrative data sources
- [x] **Professional Polish** — Consistent skeleton loaders, tooltip patterns, and a 5-dot health indicator (News, AIS, Sanctions, Prices, Network)

## In Progress
- [ ] Ready for final review / presentation preparation!

## Recent Fixes
- [x] **Gemini Risk Scoring Fallback Root Cause Fixed**: Confirmed on 2026-07-22 with instrumented `/api/risk/refresh` runs. Corridor scoring was failing before any Gemini HTTP request because `RiskAssessment` used a nested Pydantic schema (`severity_per_event: List[EventSeverity]`), and `google-genai==0.3.0` rejected the generated `$defs/$ref` schema with `Extra inputs are not permitted`. Supplier scoring also exposed a separate model entitlement failure when using `gemini-2.5-pro`: Gemini returned HTTP 429 `RESOURCE_EXHAUSTED` with free-tier quota `limit: 0` for `gemini-2.5-pro`. Fixed by logging the complete Gemini request payload/error body/status, simplifying corridor output to a non-nested `risk_drivers: List[str]` schema, and switching `GEMINI_MODEL` to verified-working `gemini-3.1-flash-lite`. Verification: first refresh after fix produced analysis-backed corridor scores Hormuz 88, Red Sea 82, Malacca 35; after ingesting 7 new NewsAPI events, the second refresh used changed event counts (Hormuz 346, Red Sea 24, Saudi supplier 4) and produced Hormuz 88, Red Sea 82, Malacca 38, with `BASELINE_TEXT_PRESENT False`.
- [x] **Gemini Failure Visibility Improved**: The System Status page now has a working Gemini Analysis Status panel fed by `analysisAlert`; provider syntax around `activeScenario`/`analysisAlert` was repaired so future fallback states are prominent instead of only appearing as small text on each risk card.
- [x] **Ingestion Static Data Root Cause Fixed**: Confirmed with two instrumented ingestion runs on 2026-07-22. GDELT was not returning live JSON because the query was too broad/invalid (`Your query was too short or too long.`). NewsAPI was live but had no explicit rolling date window, so repeat runs returned the same top page and dedup skipped it. EIA was returning HTTP 403 `API_KEY_INVALID`, then silently inserting hardcoded `EIA_fallback` Brent/WTI rows. AIS had no `AISHUB_USERNAME`, then silently inserted `backend/data/mock_ais_data.json`. Fixed by adding redacted request/response diagnostics, switching GDELT and NewsAPI to rolling 48-hour windows, narrowing GDELT to a valid compact query with one retry for 429s, skipping unclassified news instead of defaulting it to Hormuz, removing EIA hardcoded price fallback, removing AIS mock insertion, and preventing API endpoints from serving historical fallback/mock rows as live data.
- [x] **Honest Freshness Contract**: News/GDELT are request-time pulls over the last 48 hours and can reasonably be polled every 15-30 minutes on free/public tiers. NewsAPI may be limited by free-tier quota/availability. EIA spot prices are daily and require a valid EIA key; they should not be described as minute-level market data. AISHub requires valid feed access; without `AISHUB_USERNAME`, the dashboard shows AIS unavailable/degraded rather than fake live vessels.
- [x] Procurement recommendations now log the incoming scenario_id, the active scenario impact row, and the corridor risk row before scoring.
- [x] Distance & Risk scoring now keys off the scenario's disrupted corridor with supplier route exposure, so Hormuz and Red Sea scenarios no longer share identical rankings.
- [x] Frontend scenario simulation and procurement requests now log distinct scenario_id payloads per card/button before calling the API.
- [x] Network Map rebuilt on a real geographic base layer with Leaflet tiles, curved shipping routes, collision-aware labels, and distinct node markers.
- [x] Added `leaflet/dist/leaflet.css` to the frontend layout; no new package install was required because Leaflet was already present in `package.json`.
- [x] Supplier risk endpoint now self-heals when `supplier_risk_scores` is empty, logs the supplier scoring pass, and the UI no longer renders an empty table as `0 / SAFE`.
- [x] **Supplier Risk Scoring Bug Fixed**: The actual root cause for 0/100 scores was (c) API returned empty list `[]` leading to a 0 UI default, combined with an DB persistence failure. 1) A Pydantic schema validation error (nested `$ref` issue) caused the Gemini API call to fail and fall back to baseline scores. 2) The baseline scores failed to save to the database due to a Supabase Row-Level Security (RLS) policy error (code 42501) on the `supplier_risk_scores` table. 3) Because the write failed, the API route still read an empty table and returned `[]`. Fixed by simplifying the schema to `SupplierRiskAssessment` and updating `GET /api/risk/suppliers` to directly return the `computed_scores` if the DB read returns empty after bootstrapping.
## Known Issues / TODOs
- AISHub requires `AISHUB_USERNAME`; without it, no AIS rows are ingested or served as live data.
- EIA currently returns HTTP 403 `API_KEY_INVALID` with the configured key; replace it with a real EIA key before claiming live Brent/WTI prices.
- NewsAPI free tier has request/day and article-availability limits; use a 15-30 minute polling cadence rather than claiming true continuous streaming.
- GDELT may briefly return HTTP 429; ingestion retries once and logs the raw response.
- `SUPABASE_KEY` must be the anon key (`eyJ...`), not the secret key.

## Key Decisions
- **Leaflet / SVG Map**: Used a custom SVG network graph overlay. This avoids API key complexity while still looking highly professional and meeting the "geospatial digital twin" requirement.
- **Robustness over DB state**: Built fallbacks into all backend agents so the demo runs seamlessly even if SQL migrations haven't been applied to a fresh database yet.
- **Transparent methodology**: Added the `HowThisWorks` component specifically to impress technical judges with our honesty about where real data ends and illustrative assumptions begin.

## Environment/Setup Notes
*(See `backend/.env.example` and `frontend/README.md` for full setup instructions).*
