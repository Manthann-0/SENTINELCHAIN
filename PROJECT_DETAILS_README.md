# SentinelChain

**AI-Driven Energy Supply Chain Resilience for Import-Dependent Economies**

Built for ET AI Hackathon 2026 — Supply Chain Intelligence / Energy Security / Geopolitical Risk track.

---

## What This Is

India sources roughly 88% of its crude oil from imports, with 40–45% of that volume transiting the Strait of Hormuz — a structural vulnerability repeatedly stress-tested by geopolitical events (2025 US–Iran standoff, Red Sea shipping attacks, renewed sanctions pressure). India's Strategic Petroleum Reserves cover only about 9.5 days of national consumption.

Traditional supply chain planning tools weren't built for this environment — they can't model geopolitical scenario impacts in real time, evaluate alternative procurement corridors dynamically, or orchestrate a coordinated response across refiners, logistics providers, and strategic reserves.

**SentinelChain** turns that reactive crisis response into a managed, anticipatory process. It continuously monitors geopolitical and logistics risk signals, models disruption scenarios and their downstream impacts, and generates ranked, executable procurement rerouting recommendations — all explainable and traceable back to source data.

---

## Core Features

| Feature | What it does |
|---|---|
| **Geopolitical Risk Intelligence Agent** | Ingests news, AIS shipping data, sanctions registries, and commodity prices to produce a live 0–100 disruption risk score per shipping corridor |
| **Disruption Scenario Modeller** | Simulates specific events (Hormuz partial closure, Red Sea suspension, OPEC+ emergency cut) and computes cascading impact on refinery run rates, price premiums, and reserve depletion |
| **Adaptive Procurement Orchestrator** | Ranks alternative crude sources by price, transit risk, and refinery compatibility, with an AI-generated rationale for each recommendation |
| **Strategic Reserve Optimisation Agent** | Models an SPR drawdown schedule against the forecasted supply gap |
| **Unified Dashboard / Digital Twin** | Single-screen geospatial command center — live risk map, scenario simulator, and recommendation panel in one continuous flow |

---

## How It Works (Agent Flow)

```
Data Ingestion (GDELT, EIA, AISHub, OFAC)
        │
        ▼
Geopolitical Risk Intelligence Agent  →  corridor risk scores
        │
        ▼
Disruption Scenario Modeller  →  cascading impact (run rate, price, SPR days)
        │
        ├──► Adaptive Procurement Orchestrator  →  ranked rerouting recommendations
        │
        └──► Strategic Reserve Optimisation Agent  →  SPR drawdown plan
                        │
                        ▼
              Unified Dashboard / Digital Twin
```

Every computed number is traceable back to a database row or a retrieved source document — there's no black-box scoring. The scenario cascade engine uses transparent, documented formulas rather than an opaque ML model, so every output can be explained and defended.

---

## Tech Stack

- **Backend:** Python (FastAPI)
- **Database:** Postgres (Supabase free tier)
- **Vector store / RAG:** Chroma (self-hosted, local embeddings via sentence-transformers)
- **LLM:** Claude API (signal extraction, scenario narratives, recommendation rationale)
- **Frontend:** Next.js + Tailwind CSS
- **Geospatial visualization:** deck.gl / Mapbox GL JS
- **Hosting:** Vercel (frontend) + Render/Railway free tier (backend)

All infrastructure runs on free tiers — no paid services required to reproduce this prototype.

---

## Data Sources

| Data | Source |
|---|---|
| Geopolitical news/events | GDELT Project, NewsAPI.org |
| Commodity prices (Brent/WTI) | U.S. EIA Open Data API |
| Vessel/shipping positions | AISHub |
| Sanctions registry | OFAC SDN List |
| India import/chokepoint context | PPAC (Govt of India), EIA World Oil Transit Chokepoints report |

All sources are free/public where available. News is fetched live from GDELT/NewsAPI with rolling time windows. AIS requires AISHub credentials; when unavailable, the app reports AIS as unavailable instead of serving a cached/mock feed.

---

## Project Structure

```
sentinelchain/
├── backend/
│   ├── ingestion/          # GDELT, EIA, AISHub, OFAC pull scripts
│   ├── agents/
│   │   ├── risk_intelligence.py
│   │   ├── scenario_modeller.py
│   │   ├── procurement_orchestrator.py
│   │   └── reserve_optimiser.py
│   ├── db/                 # schema + migrations
│   └── main.py              # FastAPI app
├── frontend/
│   ├── app/                 # Next.js pages
│   ├── components/          # dashboard, map, scenario cards, recommendation panel
│   └── styles/
└── docs/
    ├── architecture-diagram.svg
    └── build-plan.md
```

---

## Build Status (4-Stage Plan)

- [ ] **Stage 1** — Data ingestion + Geopolitical Risk Intelligence Agent + live risk dashboard
- [ ] **Stage 2** — Disruption Scenario Modeller + cascade engine + LLM narrative
- [ ] **Stage 3** — Procurement Orchestrator (+ optional Reserve Optimisation Agent)
- [ ] **Stage 4** — Digital Twin map + unified dashboard + demo polish

See `ANTIGRAVITY_PROMPTS.md` for the full build prompt used at each stage.

---

## Judging Criteria Alignment

| Criteria | Weight | How this project addresses it |
|---|---|---|
| Innovation | 25% | Fuses geopolitical signals, shipping data, and market prices into one continuously-updating risk-to-decision pipeline |
| Business Impact | 25% | Directly targets India's 9.5-day reserve buffer and the 47-day slower stabilization gap identified by McKinsey for economies without automated response |
| Technical Excellence | 20% | Hybrid SQL + vector RAG architecture, explainable rule-based scenario engine, full data traceability |
| Scalability | 15% | Corridor/agent design generalizes to any import-dependent economy, not just India |
| User Experience | 15% | Single-screen command-center dashboard, no disconnected multi-page navigation |

---

## Limitations (Prototype Scope)

- AIS vessel data requires AISHub feed access; without credentials, AIS is unavailable/degraded rather than mocked.
- Scenario cascade formulas are simplified, transparent approximations — not a full econometric model
- Reserve Optimisation Agent is stretch scope and may be partial depending on build time
- Refinery compatibility scores use a simplified static reference table rather than live refinery configuration data
