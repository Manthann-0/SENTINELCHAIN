'use client';

import Link from 'next/link';
import { useDashboard } from '@/components/DashboardProvider';
import StrategicReservePlan from '@/components/StrategicReservePlan';

export default function ReservePage() {
  const { reservePlan, procLoading, activeScenario } = useDashboard();

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Response Planning</div>
          <h1 className="page-title">Strategic Reserve Plan</h1>
          <p className="page-subtitle">
            Projected day-by-day drawdown of India&apos;s Strategic Petroleum Reserve over the
            disruption gap plus replenishment lag, with a 3-day floor target.
          </p>
        </div>
        {activeScenario && <span className="sev-chip" data-sev="stressed">Scenario: {activeScenario.name}</span>}
      </div>

      {!activeScenario ? (
        <div className="route-empty">
          No active scenario. The reserve drawdown plan is generated from a disruption scenario.
          <br />
          <Link href="/scenarios" className="re-cta">Run a scenario →</Link>
        </div>
      ) : procLoading ? (
        <div className="loading-state">
          <div className="btn-spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <p>Computing reserve drawdown schedule…</p>
        </div>
      ) : reservePlan.length === 0 ? (
        <div className="route-empty">No reserve plan available for this scenario yet.</div>
      ) : (
        <StrategicReservePlan plan={reservePlan} />
      )}
    </main>
  );
}
