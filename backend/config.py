"""
SentinelChain — Configuration & Constants
Loads environment variables and defines corridor reference data.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ─── API Keys & Credentials ──────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
EIA_API_KEY = os.getenv("EIA_API_KEY", "")
AISHUB_USERNAME = os.getenv("AISHUB_USERNAME", "")

# ─── Gemini Model ────────────────────────────────────────────────────────────
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

# ─── Chroma Config ────────────────────────────────────────────────────────────
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
CHROMA_COLLECTION_NAME = "documents"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# ─── Corridor Definitions ────────────────────────────────────────────────────
# Static reference data from PPAC / EIA World Oil Transit Chokepoints report.
# India imports ~4.7 million bpd of crude; ~88% import dependency.

CORRIDORS = {
    "hormuz": {
        "name": "Strait of Hormuz",
        "keywords": [
            "Hormuz", "Iran", "Persian Gulf", "IRGC",
            "tanker seizure", "Iran strait", "Gulf of Oman",
        ],
        "lat_range": (25.5, 27.0),
        "lon_range": (55.5, 57.0),
        "india_share_pct": 0.42,   # ~42% of India's crude imports transit Hormuz
        "daily_flow_mbpd": 20.5,   # ~20.5 million bpd global flow
        "description": (
            "World's most critical oil chokepoint. ~20.5 mbpd transit daily. "
            "Iran borders the northern shore; any closure could remove ~20% of "
            "global oil supply from the market within hours."
        ),
    },
    "red_sea": {
        "name": "Bab-el-Mandeb / Red Sea",
        "keywords": [
            "Red Sea", "Houthi", "Bab-el-Mandeb", "Yemen",
            "Suez", "Suez Canal", "Bab el-Mandeb",
        ],
        "lat_range": (12.0, 13.5),
        "lon_range": (43.0, 44.0),
        "india_share_pct": 0.12,   # ~12% of India's imports via Red Sea/Suez route
        "daily_flow_mbpd": 8.8,    # ~8.8 million bpd
        "description": (
            "Connects Red Sea to Gulf of Aden. Houthi attacks since late 2023 "
            "have forced rerouting via Cape of Good Hope, adding 10-14 days "
            "transit time and $1-2M per voyage in additional costs."
        ),
    },
    "malacca": {
        "name": "Strait of Malacca",
        "keywords": [
            "Malacca", "Singapore Strait", "South China Sea",
            "piracy Malacca", "Strait of Malacca",
        ],
        "lat_range": (1.0, 4.0),
        "lon_range": (100.0, 104.5),
        "india_share_pct": 0.08,   # ~8% of India's imports (mainly from SE Asia/Australia)
        "daily_flow_mbpd": 16.0,   # ~16 million bpd
        "description": (
            "Shortest sea route between Indian and Pacific Oceans. Critical for "
            "crude flows from SE Asia and LNG from Australia/Qatar to East Asia. "
            "Piracy risk and potential great-power friction in South China Sea."
        ),
    },
}

# ─── Supplier Definitions ────────────────────────────────────────────────────
# The top 5 key suppliers for India's crude imports.

SUPPLIERS = {
    "Russia": {
        "benchmark": "Brent",  # Urals trades at discount to Brent
        "keywords": ["Russia oil", "Urals crude", "Sokol crude", "Russian export", "Novak", "Putin oil", "Rosneft"],
    },
    "Saudi Arabia": {
        "benchmark": "Brent",
        "keywords": ["Saudi oil", "Aramco", "Saudi export", "OPEC+", "Saudi production", "Riyadh oil"],
    },
    "UAE": {
        "benchmark": "Brent",
        "keywords": ["UAE oil", "ADNOC", "Fujairah", "Emirates oil", "Murban crude"],
    },
    "USA": {
        "benchmark": "WTI",
        "keywords": ["US crude", "WTI", "Permian basin", "US export", "SPR release", "Texas oil"],
    },
    "Nigeria": {
        "benchmark": "Brent",
        "keywords": ["Nigeria oil", "Bonny Light", "Niger Delta", "NNPC", "Nigerian export"],
    },
}

# Combined keyword list for broad searches (GDELT, NewsAPI)
GENERAL_KEYWORDS = [
    "OPEC", "sanctions crude oil", "tanker attack",
    "oil supply disruption", "crude oil embargo",
    "maritime security Middle East", "oil shipping risk",
]

# Build a flat keyword list for API queries
ALL_KEYWORDS = list(GENERAL_KEYWORDS)
for corridor in CORRIDORS.values():
    ALL_KEYWORDS.extend(corridor["keywords"])
for supplier in SUPPLIERS.values():
    ALL_KEYWORDS.extend(supplier["keywords"])

# Deduplicate while preserving order
_seen = set()
UNIQUE_KEYWORDS = []
for kw in ALL_KEYWORDS:
    if kw.lower() not in _seen:
        _seen.add(kw.lower())
        UNIQUE_KEYWORDS.append(kw)
