'use client';

import { useDashboard } from '@/components/DashboardProvider';
import SystemStatusTimeline from '@/components/SystemStatusTimeline';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import HowThisWorks from '@/components/HowThisWorks';

const SOURCES = [
  { key: 'news', name: 'News & Events', src: 'GDELT / NewsAPI' },
  { key: 'ais', name: 'Vessel Tracking', src: 'AISHub credential required' },
  { key: 'sanctions', name: 'Sanctions', src: 'OFAC SDN' },
  { key: 'prices', name: 'Crude Prices', src: 'EIA Open Data' },
  { key: 'network', name: 'Network Data', src: 'Digital Twin' },
];
const STATE_CLASS = { ok: 'hr-ok', degraded: 'hr-degraded', down: 'hr-down', unknown: 'hr-degraded' };
const STATE_LABEL = { ok: 'Operational', degraded: 'Degraded', down: 'Offline', unknown: 'Checking' };
const STATE_COLOR = { ok: 'var(--sev-normal)', degraded: 'var(--sev-stressed)', down: 'var(--sev-disrupted)', unknown: 'var(--text-muted)' };

export default function SystemPage() {
  const { health, lastRefresh, lastIngestion, analysisAlert } = useDashboard();

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">System</div>
          <h1 className="page-title">System Status &amp; How This Works</h1>
          <p className="page-subtitle">
            Operational transparency for every data source, the system architecture, and an honest
            account of what is live versus illustrative.
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <SystemStatusTimeline />
        </div>

        <div className="panel">
          <div className="panel-title">Source Status</div>
          <div className="health-list">
            {SOURCES.map((s) => {
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
          <div className="oil-source-line">
            Last scores: {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '—'} · Last ingest:{' '}
            {lastIngestion ? new Date(lastIngestion).toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      <div className={`panel ${analysisAlert.status === 'degraded' ? 'panel-warning' : ''}`} style={{ marginTop: '1rem' }}>
        <div className="panel-title">Gemini Analysis Status</div>
        <div className="oil-source-line" style={{ marginBottom: '0.75rem' }}>
          {analysisAlert.title}
        </div>
        <p className="uptime-note" style={{ marginTop: 0 }}>
          {analysisAlert.message}
        </p>
        {analysisAlert.affected.length > 0 && (
          <div className="health-list" style={{ marginTop: '0.85rem' }}>
            {analysisAlert.affected.map((item) => (
              <div className="health-row" key={item.id}>
                <span className="hr-dot" style={{ background: analysisAlert.status === 'degraded' ? 'var(--sev-stressed)' : 'var(--sev-normal)' }} />
                <span className="hr-name">{item.name}</span>
                <span className="hr-src">{item.summary}</span>
                <span className={`hr-state ${analysisAlert.status === 'degraded' ? 'hr-degraded' : 'hr-ok'}`}>
                  {analysisAlert.status === 'degraded' ? 'Baseline fallback' : 'Analysis-backed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-label">System architecture</div>
      <ArchitectureDiagram />

      <HowThisWorks />
    </main>
  );
}
