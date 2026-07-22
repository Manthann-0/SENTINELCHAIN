'use client';

import { useState } from 'react';
import { useDashboard } from '@/components/DashboardProvider';
import RiskScoreCard from '@/components/RiskScoreCard';
import RiskTrendChart from '@/components/RiskTrendChart';
import CorridorComparisonTable from '@/components/CorridorComparisonTable';
import EventFeed from '@/components/EventFeed';
import { CORRIDORS } from '@/lib/severity';

export default function CorridorRiskPage() {
  const { scores, history, events, runIngestion, highestCorridor } = useDashboard();
  const [activeCorridor, setActiveCorridor] = useState(null);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Risk Monitoring</div>
          <h1 className="page-title">Corridor Risk</h1>
          <p className="page-subtitle">
            AI-scored geopolitical disruption risk for the three chokepoints carrying India&apos;s
            crude imports — Strait of Hormuz, Bab-el-Mandeb / Red Sea, and Strait of Malacca.
          </p>
        </div>
      </div>

      <div className="risk-cards-grid">
        {CORRIDORS.map((cid) => (
          <RiskScoreCard
            key={cid}
            corridorId={cid}
            score={scores[cid]}
            history={history[cid]}
            onClick={(id) => setActiveCorridor((cur) => (cur === id ? null : id))}
            isActive={activeCorridor === cid}
            isHighest={cid === highestCorridor?.id}
          />
        ))}
      </div>

      <div className="section-label">Cross-corridor comparison</div>
      <CorridorComparisonTable activeCorridor={activeCorridor} onSelect={setActiveCorridor} />

      <div className="section-label">7-day trend</div>
      <RiskTrendChart historyData={history} />

      <div className="section-label">Contributing events</div>
      <EventFeed events={events} activeCorridor={activeCorridor} onRunIngestion={runIngestion} />
    </main>
  );
}
