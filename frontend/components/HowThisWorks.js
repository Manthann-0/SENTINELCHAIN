'use client';

import { useState } from 'react';

export default function HowThisWorks() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="how-it-works-panel">
      <button
        className="how-it-works-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="how-icon">Data</span>
        <span>How This Works - Data Sources & Assumptions</span>
        <span className={`how-chevron ${isExpanded ? 'open' : ''}`}>v</span>
      </button>

      {isExpanded && (
        <div className="how-it-works-content">
          <div className="how-grid">
            <div className="how-section">
              <h4>Live Data Sources</h4>
              <ul>
                <li><strong>News Events:</strong> GDELT DOC 2.0 and NewsAPI are queried with a rolling 48-hour window and energy/shipping filters.</li>
                <li><strong>Crude Oil Prices:</strong> EIA Open Data is used only when a valid EIA API key is configured. Invalid keys now surface as ingestion errors.</li>
                <li><strong>Sanctions:</strong> OFAC SDN data is loaded from the local sanctioned-entity subset used by the demo database.</li>
                <li><strong>Risk Scoring:</strong> Gemini 3.1 Flash-Lite synthesizes recent events, sanctions, vessel counts, and prices into 0-100 corridor and supplier scores.</li>
                <li><strong>RAG Context:</strong> ChromaDB embeds ingested articles for retrieval-augmented risk justifications.</li>
              </ul>
            </div>

            <div className="how-section">
              <h4>Current Limits</h4>
              <ul>
                <li><strong>AIS Vessel Data:</strong> AISHub requires a valid username and feed access. If unavailable, the app reports AIS ingestion unavailable and does not insert mock rows.</li>
                <li><strong>News Freshness:</strong> Manual ingest and the dashboard poll run on a practical free-tier cadence, not true continuous streaming.</li>
                <li><strong>NewsAPI Free Tier:</strong> Request quotas and article availability can limit recency. HTTP status and raw error bodies are logged during ingestion.</li>
                <li><strong>Price Freshness:</strong> EIA spot prices are daily, so they will not change every few minutes even with valid credentials.</li>
                <li><strong>Scenario Metrics:</strong> Cascade outputs use documented formulas and public constants; they are planning estimates, not live refinery telemetry.</li>
              </ul>
            </div>

            <div className="how-section full-width">
              <h4>Cascade Engine Methodology</h4>
              <p>
                The disruption scenario engine uses rule-based formulas with documented constants
                from public energy-market sources. The network digital twin visualizes those cascade
                calculations by propagating stress along the supply-chain graph; it does not add a
                separate prediction model.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
