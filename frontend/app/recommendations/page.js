'use client';

import Link from 'next/link';
import { useDashboard } from '@/components/DashboardProvider';
import ProcurementRecommendations from '@/components/ProcurementRecommendations';
import RecommendationRadar from '@/components/RecommendationRadar';

const RADAR_COLORS = ['#2dd4bf', '#f59e0b', '#8b5cf6'];

export default function RecommendationsPage() {
  const { recommendations, procLoading, procError, activeScenario } = useDashboard();

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Response Planning</div>
          <h1 className="page-title">Procurement Recommendations</h1>
          <p className="page-subtitle">
            Alternative crude suppliers ranked across five factors for the active scenario — price,
            distance &amp; risk, tanker availability, port congestion, and refinery compatibility.
          </p>
        </div>
        {activeScenario && <span className="sev-chip" data-sev="stressed">Scenario: {activeScenario.name}</span>}
      </div>

      {!activeScenario ? (
        <div className="route-empty">
          No active scenario. Recommendations are generated from a disruption scenario.
          <br />
          <Link href="/scenarios" className="re-cta">Run a scenario →</Link>
        </div>
      ) : procLoading ? (
        <div className="loading-state">
          <div className="btn-spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <p>Orchestrating procurement strategy…</p>
        </div>
      ) : procError ? (
        <div className="scenario-error">{procError}</div>
      ) : recommendations.length === 0 ? (
        <div className="route-empty">No recommendations available for this scenario yet.</div>
      ) : (
        <>
          <div className="section-label">Multi-factor profiles</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(3, recommendations.length)}, 1fr)`,
              gap: 'var(--space-4)',
            }}
          >
            {recommendations.slice(0, 3).map((rec, i) => (
              <div className="panel" key={rec.id || rec.source_country}>
                <div className="panel-title">
                  #{rec.rank || i + 1} {rec.source_country}
                  <span className="pt-sub tile-mono">{Number(rec.final_score).toFixed(1)}/100</span>
                </div>
                <RecommendationRadar rec={rec} color={RADAR_COLORS[i % RADAR_COLORS.length]} />
              </div>
            ))}
          </div>

          <div className="section-label">Detailed ranking</div>
          <ProcurementRecommendations recommendations={recommendations} />
        </>
      )}
    </main>
  );
}
