'use client';
import InfoTooltip from '@/components/InfoTooltip';

function riskLabel(score) {
  if (score >= 75) return { text: 'HIGH', cls: 'risk-critical' };
  if (score >= 50) return { text: 'MED', cls: 'risk-elevated' };
  if (score >= 30) return { text: 'LOW', cls: 'risk-moderate' };
  return { text: 'SAFE', cls: 'risk-low' };
}

function TrendIndicator({ history }) {
  if (!history || history.length < 2) {
    return <span className="supplier-trend neutral">─</span>;
  }
  const latest = history[0]?.score ?? 0;
  const prev = history[1]?.score ?? latest;
  const delta = latest - prev;
  
  if (delta > 0) return <span className="supplier-trend up">▲ +{delta.toFixed(0)}</span>;
  if (delta < 0) return <span className="supplier-trend down">▼ {delta.toFixed(0)}</span>;
  return <span className="supplier-trend neutral">─</span>;
}

export default function SupplierRiskCard({ supplier, scoreData, history }) {
  const hasScore = scoreData && typeof scoreData.score === 'number';
  const currentScore = hasScore ? scoreData.score : null;
  const level = hasScore ? riskLabel(currentScore) : { text: 'NO DATA', cls: 'risk-unknown' };
  
  return (
    <div className="supplier-card">
      <div className="supplier-card-header">
        <span className="supplier-name">{supplier}</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className={`supplier-badge ${level.cls}`}>{level.text}</span>
          <InfoTooltip text="Disruption risk score based on sanctions exposure and supply chain signals." />
        </div>
      </div>
      
      <div className="supplier-card-body">
        <div className="supplier-score-wrap">
          <span className={`supplier-score ${hasScore ? '' : 'supplier-score--empty'}`}>{hasScore ? Math.round(currentScore) : '—'}</span>
          <span className="supplier-max">/100</span>
        </div>
        <TrendIndicator history={history} />
      </div>
      
      <div className="supplier-bar-track">
        <div 
          className={`supplier-bar-fill ${level.cls}-bg`}
          style={{ width: `${Math.min(100, Math.max(0, currentScore ?? 0))}%` }}
        />
      </div>
    </div>
  );
}
