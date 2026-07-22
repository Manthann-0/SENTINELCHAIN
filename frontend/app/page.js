'use client';

import Link from 'next/link';
import { useDashboard } from '@/components/DashboardProvider';
import OilPricePanel from '@/components/OilPricePanel';
import { CORRIDOR_META, SEV_LABEL, severityFromScore } from '@/lib/severity';

const HEALTH_SOURCES = [
  { key: 'news', name: 'News & Events', src: 'GDELT / NewsAPI' },
  { key: 'ais', name: 'Vessel Tracking', src: 'AISHub credential required' },
  { key: 'sanctions', name: 'Sanctions', src: 'OFAC SDN' },
  { key: 'prices', name: 'Crude Prices', src: 'EIA Open Data' },
  { key: 'network', name: 'Network Data', src: 'Digital Twin' },
];

const STATE_CLASS = { ok: 'hr-ok', degraded: 'hr-degraded', down: 'hr-down', unknown: 'hr-degraded' };
const STATE_LABEL = { ok: 'Operational', degraded: 'Degraded', down: 'Offline', unknown: 'Checking' };
const STATE_COLOR = { ok: 'var(--sev-normal)', degraded: 'var(--sev-stressed)', down: 'var(--sev-disrupted)', unknown: 'var(--text-muted)' };

export default function OverviewPage() {
  const {
    highestCorridor, highestSupplier, activeScenario, scenarioImpact,
    recommendations, health, isLoaded,
  } = useDashboard();

  const corSev = highestCorridor?.severity || 'normal';
  const supSev = highestSupplier ? severityFromScore(highestSupplier.score) : 'normal';
  const topRec = recommendations?.[0] || null;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Command Center</div>
          <h1 className="page-title">Energy Supply Chain Overview</h1>
          <p className="page-subtitle">
            Live geopolitical &amp; market risk for India&apos;s crude oil imports — corridor and
            supplier state, active disruption scenario, and benchmark prices at a glance.
          </p>
        </div>
      </div>

      <div className="overview-grid">
        {/* Highest-risk corridor */}
        <Link href="/corridors" className={`col-3 stat-tile sev-l-${corSev}`}>
          <div className="tile-top">
            <span className="tile-eyebrow">Top Corridor Risk</span>
            <span className="sev-chip" data-sev={corSev}>{SEV_LABEL[corSev]}</span>
          </div>
          <div className="tile-value tile-mono">
            {isLoaded && highestCorridor ? Math.round(highestCorridor.score) : '—'}
            <span className="tv-unit">/100</span>
          </div>
          <div className="tile-name">
            {highestCorridor ? CORRIDOR_META[highestCorridor.id]?.label || highestCorridor.id : 'Awaiting data'}
          </div>
          <div className="tile-meta">View corridor risk <span className="tile-arrow">→</span></div>
        </Link>

        {/* Highest-risk supplier */}
        <Link href="/suppliers" className={`col-3 stat-tile sev-l-${supSev}`}>
          <div className="tile-top">
            <span className="tile-eyebrow">Top Supplier Risk</span>
            <span className="sev-chip" data-sev={supSev}>{SEV_LABEL[supSev]}</span>
          </div>
          <div className="tile-value tile-mono">
            {isLoaded && highestSupplier ? Math.round(highestSupplier.score) : '—'}
            <span className="tv-unit">/100</span>
          </div>
          <div className="tile-name">{highestSupplier ? highestSupplier.name : 'Awaiting data'}</div>
          <div className="tile-meta">View supplier risk <span className="tile-arrow">→</span></div>
        </Link>

        {/* Active scenario + top-line impact */}
        <Link href="/scenarios" className={`col-3 stat-tile ${activeScenario ? 'sev-l-stressed' : ''}`}>
          <div className="tile-top">
            <span className="tile-eyebrow">Active Scenario</span>
            {activeScenario && <span className="sev-chip" data-sev="stressed">Running</span>}
          </div>
          {activeScenario ? (
            <>
              <div className="tile-value tile-mono">
                +${scenarioImpact ? Number(scenarioImpact.price_premium).toFixed(1) : '—'}
                <span className="tv-unit">/bbl</span>
              </div>
              <div className="tile-name">{activeScenario.name}</div>
              <div className="tile-meta">Projected price premium <span className="tile-arrow">→</span></div>
            </>
          ) : (
            <>
              <div className="tile-value" style={{ fontSize: 20, color: 'var(--text-muted)' }}>None active</div>
              <div className="tile-name" style={{ color: 'var(--text-secondary)' }}>Simulate a disruption</div>
              <div className="tile-meta">Open simulator <span className="tile-arrow">→</span></div>
            </>
          )}
        </Link>

        {/* Top procurement recommendation */}
        <Link href="/recommendations" className={`col-3 stat-tile ${topRec ? 'sev-l-normal' : ''}`}>
          <div className="tile-top">
            <span className="tile-eyebrow">Top Recommendation</span>
            {topRec && <span className="sev-chip" data-sev="normal">#1</span>}
          </div>
          {topRec ? (
            <>
              <div className="tile-value tile-mono">
                {Number(topRec.final_score).toFixed(0)}<span className="tv-unit">/100</span>
              </div>
              <div className="tile-name">{topRec.source_country}</div>
              <div className="tile-meta">Procurement ranking <span className="tile-arrow">→</span></div>
            </>
          ) : (
            <>
              <div className="tile-value" style={{ fontSize: 20, color: 'var(--text-muted)' }}>—</div>
              <div className="tile-name" style={{ color: 'var(--text-secondary)' }}>Run a scenario first</div>
              <div className="tile-meta">View recommendations <span className="tile-arrow">→</span></div>
            </>
          )}
        </Link>

        {/* Live crude prices */}
        <div className="col-8">
          <OilPricePanel />
        </div>

        {/* System health */}
        <div className="col-4">
          <div className="panel">
            <div className="panel-title">
              System Health
              <Link href="/system" className="pt-sub" style={{ color: 'var(--sev-normal)', textDecoration: 'none' }}>Details →</Link>
            </div>
            <div className="health-list">
              {HEALTH_SOURCES.map((s) => {
                const st = health?.[s.key] || 'unknown';
                return (
                  <div className="health-row" key={s.key}>
                    <span className="hr-dot" style={{ background: STATE_COLOR[st], color: STATE_COLOR[st] }} />
                    <span className="hr-name">{s.name}</span>
                    <span className="hr-src">{s.src}</span>
                    <span className={`hr-state ${STATE_CLASS[st]}`}>{STATE_LABEL[st]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
