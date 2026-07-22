'use client';

import { useDashboard } from '@/components/DashboardProvider';
import SupplierRiskCard from '@/components/SupplierRiskCard';
import { SUPPLIERS, severityFromScore, SEV_LABEL, SEV_COLOR } from '@/lib/severity';

export default function SupplierRiskPage() {
  const { supplierScores, supplierHistory, highestSupplier } = useDashboard();

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Risk Monitoring</div>
          <h1 className="page-title">Supplier Risk</h1>
          <p className="page-subtitle">
            Disruption risk for India&apos;s top crude suppliers, scored from sanctions exposure,
            geopolitical signals, and corridor dependence.
          </p>
        </div>
        {highestSupplier && (
          <span className="sev-chip" data-sev={severityFromScore(highestSupplier.score)}>
            Highest: {highestSupplier.name} · {SEV_LABEL[severityFromScore(highestSupplier.score)]}
          </span>
        )}
      </div>

      <div className="supplier-cards-grid">
        {SUPPLIERS.map((sup) => (
          <SupplierRiskCard
            key={sup}
            supplier={sup}
            scoreData={supplierScores[sup]}
            history={supplierHistory[sup]}
          />
        ))}
      </div>

      <div className="section-label">How supplier risk is scored</div>
      <div className="panel">
        <div className="health-list">
          {[
            ['Sanctions exposure', 'OFAC SDN entities linked to the supplier or its carriers'],
            ['Geopolitical signals', 'News & GDELT events mentioning the supplier or its export routes'],
            ['Corridor dependence', 'Share of the supplier’s flow that transits a stressed chokepoint'],
          ].map(([k, v]) => (
            <div className="health-row" key={k}>
              <span className="hr-dot" style={{ background: SEV_COLOR.normal, color: SEV_COLOR.normal }} />
              <span className="hr-name">{k}</span>
              <span className="hr-src" style={{ maxWidth: '60ch', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
