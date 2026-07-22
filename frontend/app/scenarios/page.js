'use client';

import Link from 'next/link';
import { useDashboard } from '@/components/DashboardProvider';
import ScenarioSimulator from '@/components/ScenarioSimulator';

export default function ScenariosPage() {
  const { activeScenario } = useDashboard();

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Response Planning</div>
          <h1 className="page-title">Scenario Simulator</h1>
          <p className="page-subtitle">
            Run a supply-shock scenario through the cascade engine. Impact metrics are shown against
            their normal baselines, and the result drives the Network Map, Recommendations, and
            Reserve Plan across the app.
          </p>
        </div>
        {activeScenario && (
          <Link href="/recommendations" className="re-cta" style={{ marginTop: 0 }}>
            View procurement strategy →
          </Link>
        )}
      </div>

      <ScenarioSimulator />
    </main>
  );
}
