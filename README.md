# SentinelChain

**AI-Driven Energy Supply Chain Resilience for Import-Dependent Economies**

Built for ET AI Hackathon 2026 — Supply Chain Intelligence / Energy Security / Geopolitical Risk track.

---

## Overview

India sources ~88% of its crude oil from imports, with 40–45% transiting the Strait of Hormuz. With strategic petroleum reserves covering only ~9.5 days of consumption, any geopolitical disruption creates an immediate crisis.

SentinelChain turns reactive crisis response into a managed, anticipatory process. It continuously monitors geopolitical and logistics risk signals, models disruption scenarios, and generates ranked, executable procurement rerouting recommendations — all explainable and traceable back to source data.

---

## Features

| Agent | Description |
|---|---|
| Geopolitical Risk Intelligence | Ingests news, AIS shipping data, sanctions registries, and commodity prices to produce a live 0–100 disruption risk score per corridor |
| Disruption Scenario Modeller | Simulates events (Hormuz closure, Red Sea suspension, OPEC+ cut) and computes cascading impact on refinery run rates, price premiums, and reserve depletion |
| Adaptive Procurement Orchestrator | Ranks alternative crude sources by price, transit risk, and refinery compatibility with AI-generated rationale |
| Strategic Reserve Optimisation | Models SPR drawdown schedule against forecasted supply gap |
| Unified Dashboard | Live risk map, scenario simulator, and recommendation panel in one screen |

---

## Agent Flow

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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Database | PostgreSQL (Supabase) |
| Vector Store / RAG | ChromaDB + sentence-transformers |
| LLM | Google Gemini |
| Frontend | Next.js, Tailwind CSS |
| Geospatial | deck.gl / Mapbox GL JS |

---

## Data Sources

| Data | Source |
|---|---|
| Geopolitical news/events | GDELT Project, NewsAPI.org |
| Commodity prices (Brent/WTI) | U.S. EIA Open Data API |
| Vessel/shipping positions | AISHub |
| Sanctions registry | OFAC SDN List |

---

## Project Structure

```
sentinelchain/
├── backend/
│   ├── agents/             # Risk, scenario, procurement, reserve agents
│   ├── ingestion/          # GDELT, EIA, AISHub, OFAC data pull scripts
│   ├── db/                 # Schema + migrations
│   ├── main.py             # FastAPI app entry point
│   ├── config.py
│   ├── database.py
│   ├── vector_store.py
│   └── requirements.txt
├── frontend/
│   ├── app/                # Next.js pages
│   ├── components/         # Dashboard, map, scenario cards, recommendation panel
│   └── lib/                # API helpers
└── README.md
```

---

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # Fill in your API keys
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # Set NEXT_PUBLIC_API_URL to your backend URL
npm run dev
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```
SUPABASE_URL=
SUPABASE_KEY=
GEMINI_API_KEY=
NEWSAPI_KEY=
EIA_API_KEY=
AISHUB_USERNAME=
```

---

## Deployment

| Part | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Railway / Render |
| Database | Supabase |

---

## Limitations

- AIS vessel data requires AISHub credentials; without them, AIS is reported as unavailable
- Scenario cascade formulas are transparent approximations, not a full econometric model
- Refinery compatibility scores use a simplified static reference table
