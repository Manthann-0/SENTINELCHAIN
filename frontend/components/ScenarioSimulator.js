'use client';

import { useState, useEffect } from 'react';
import { getScenarios, runScenario } from '@/lib/api';
import InfoTooltip from '@/components/InfoTooltip';
import { useDashboard } from '@/components/DashboardProvider';

// Baselines for "vs. normal" delta indicators (Part 5.3). Documented constants
// so the size of an impact is legible without knowing what "normal" looks like.
const BASELINE = {
  refinery_run_rate: 95,   // % utilization under normal supply
  price_premium: 0,        // USD/bbl added over baseline
  spr_days_remaining: 9.5, // days of strategic cover, normal
  power_sector_stress: 0,  // % grid exposure
  gdp_impact_pct: 0,       // % GDP drag
};

function DeltaPill({ value, baseline, worseWhen, unit, decimals = 1 }) {
  if (value == null || Number.isNaN(value)) return null;
  const delta = value - baseline;
  const worse = worseWhen === 'higher' ? delta > 0.05 : delta < -0.05;
  const better = worseWhen === 'higher' ? delta < -0.05 : delta > 0.05;
  const cls = worse ? 'worse' : better ? 'better' : 'flat';
  const sign = delta > 0 ? '+' : '';
  return (
    <>
      <span className={`delta-pill ${cls}`}>
        {worse ? '▲' : better ? '▼' : '─'} {sign}{delta.toFixed(decimals)}{unit} vs. baseline
      </span>
      <span className="delta-baseline">Baseline {baseline}{unit}</span>
    </>
  );
}

export default function ScenarioSimulator() {
  const { activeScenarioId, scenarioImpact, setActiveScenario } = useDashboard();
  const [scenarios, setScenarios] = useState([]);
  const [computingId, setComputingId] = useState(null);
  const [localImpact, setLocalImpact] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getScenarios();
        if (res.status === 'ok') setScenarios(res.scenarios);
      } catch (err) {
        console.error('Failed to load scenarios', err);
      }
    })();
  }, []);

  // Show the freshly-run result, or the active scenario's stored impact on revisit.
  const impactResult = localImpact || (activeScenarioId ? scenarioImpact : null);

  const handleRunScenario = async (id, source = 'card') => {
    if (computingId) return;
    setComputingId(id);
    setError(null);
    setLocalImpact(null);
    console.info('[ScenarioSimulator] simulate click', { source, payload: { scenario_id: id } });
    try {
      const res = await runScenario(id);
      if (res.status === 'ok') {
        setLocalImpact(res.impact);
        setActiveScenario(id, res.impact); // publish to the whole app
      } else {
        setError('Failed to compute scenario');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error communicating with cascade engine');
    } finally {
      setComputingId(null);
    }
  };

  return (
    <div>
      <div className="section-label">Select a disruption scenario</div>

      <div className="scenario-cards-grid">
        {scenarios.map((s) => {
          const isActive = activeScenarioId === s.id;
          const isComputing = computingId === s.id;
          return (
            <div
              key={s.id}
              className={`scenario-card ${isActive ? 'active' : ''} ${isComputing ? 'computing' : ''}`}
              onClick={() => handleRunScenario(s.id, 'card')}
            >
              <div className="scenario-header">
                <h3>{s.name}</h3>
                <div className="disruption-badge">{(s.disruption_pct * 100).toFixed(0)}% Shock</div>
              </div>
              <p className="scenario-desc">{s.assumptions?.trigger || 'Custom scenario trigger'}</p>
              <div className="scenario-meta">
                <span>{s.transit_delay_days > 0 ? `+${s.transit_delay_days} days transit` : 'Immediate impact'}</span>
                <button
                  className="btn-run"
                  disabled={isComputing}
                  onClick={(e) => { e.stopPropagation(); handleRunScenario(s.id, 'button'); }}
                >
                  {isComputing ? 'Computing…' : isActive ? 'Re-run' : 'Simulate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="scenario-error">{error}</div>}

      <div className={`impact-readout ${impactResult ? 'visible' : ''}`}>
        {impactResult && (
          <>
            <div className="impact-stats-grid">
              <div className="impact-stat-box alert-red">
                <div className="stat-label">Refinery Run-Rate <InfoTooltip text="Projected capacity utilization of Indian refineries (Baseline: 95%)." /></div>
                <div className="stat-value">{impactResult.refinery_run_rate.toFixed(1)}%</div>
                <DeltaPill value={impactResult.refinery_run_rate} baseline={BASELINE.refinery_run_rate} worseWhen="lower" unit="%" />
              </div>
              <div className="impact-stat-box alert-amber">
                <div className="stat-label">Price Premium <InfoTooltip text="Estimated crude oil price spike due to disruption and rerouting costs." /></div>
                <div className="stat-value">+${impactResult.price_premium.toFixed(2)}</div>
                <DeltaPill value={impactResult.price_premium} baseline={BASELINE.price_premium} worseWhen="higher" unit="" decimals={2} />
              </div>
              <div className="impact-stat-box alert-yellow">
                <div className="stat-label">SPR Remaining <InfoTooltip text="How many days India's strategic reserves would last if this disruption continues." /></div>
                <div className="stat-value">{impactResult.spr_days_remaining.toFixed(1)} Days</div>
                <DeltaPill value={impactResult.spr_days_remaining} baseline={BASELINE.spr_days_remaining} worseWhen="lower" unit="d" />
              </div>
              <div className="impact-stat-box alert-red">
                <div className="stat-label">Power Stress <InfoTooltip text="Estimated stress on the power grid, assuming 15% of peak generation relies on imported fuel." /></div>
                <div className="stat-value">{impactResult.power_sector_stress?.toFixed(1)}%</div>
                <DeltaPill value={impactResult.power_sector_stress} baseline={BASELINE.power_sector_stress} worseWhen="higher" unit="%" />
              </div>
              <div className="impact-stat-box alert-amber">
                <div className="stat-label">GDP Impact <InfoTooltip text="Illustrative macro-economic drag, modeled as 0.1% GDP loss per 10% price jump." /></div>
                <div className="stat-value">{impactResult.gdp_impact_pct?.toFixed(2)}%</div>
                <DeltaPill value={impactResult.gdp_impact_pct} baseline={BASELINE.gdp_impact_pct} worseWhen="higher" unit="%" decimals={2} />
              </div>
            </div>

            <div className="impact-narrative-box">
              <div className="narrative-header">
                <span className="ai-icon">✨</span>
                <span>AI Impact Assessment</span>
              </div>
              <p className="narrative-text">{impactResult.narrative}</p>
              {impactResult.sources && impactResult.sources.length > 0 && (
                <div className="narrative-sources">
                  <strong>Sources:</strong>
                  <ul>
                    {impactResult.sources.map((src, i) => (
                      <li key={i}><a href={src} target="_blank" rel="noopener noreferrer">{new URL(src).hostname}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        {computingId && !localImpact && (
          <div className="impact-shimmer">
            <div className="shimmer-stats-grid">
              <div className="shimmer-box" /><div className="shimmer-box" /><div className="shimmer-box" />
              <div className="shimmer-box" /><div className="shimmer-box" />
            </div>
            <div className="shimmer-narrative" />
          </div>
        )}
      </div>
    </div>
  );
}
