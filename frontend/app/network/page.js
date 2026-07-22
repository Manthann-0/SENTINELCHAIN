'use client';

import { useDashboard } from '@/components/DashboardProvider';
import NetworkMap from '@/components/NetworkMap';

export default function NetworkPage() {
  const { activeScenarioId, activeScenario } = useDashboard();

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Risk Monitoring · Digital Twin</div>
          <h1 className="page-title">Network Map</h1>
          <p className="page-subtitle">
            A live digital twin of India&apos;s crude supply network. When a disruption scenario is
            active, cascade stress propagates downstream from the affected import terminals through
            refineries and distribution hubs.
          </p>
        </div>
        {activeScenario ? (
          <span className="sev-chip" data-sev="stressed">Impact: {activeScenario.name}</span>
        ) : (
          <span className="sev-chip" data-sev="normal">Baseline · no active scenario</span>
        )}
      </div>

      <NetworkMap activeScenarioId={activeScenarioId} />

      <p className="uptime-note" style={{ marginTop: 'var(--space-4)' }}>
        Nodes are colored by live status — <strong style={{ color: 'var(--sev-normal)' }}>normal</strong>,{' '}
        <strong style={{ color: 'var(--sev-stressed)' }}>stressed</strong>, or{' '}
        <strong style={{ color: 'var(--sev-disrupted)' }}>disrupted</strong>. Run a scenario in the
        Scenario Simulator to see impact propagation across the graph.
      </p>
    </main>
  );
}
