'use client';

import Sparkline from './Sparkline';
import { useDashboard } from './DashboardProvider';
import { severityFromScore } from '@/lib/severity';

// Benchmark presentation. Each crude benchmark represents a region/producer and
// is the correct proxy for a supply-chain risk tool. Dubai/Oman has no reliable
// free live source, so it is shown as "Data unavailable" rather than fabricated.
const BENCHMARKS = [
  { key: 'Brent', region: 'Europe / Global Reference', color: 'var(--sev-normal)', live: true, gulf: false },
  { key: 'WTI', region: 'United States', color: 'var(--amber)', live: true, gulf: false },
  { key: 'DubaiOman', label: 'Dubai / Oman', region: 'Middle East / Gulf benchmark', color: 'var(--text-dim)', live: false, gulf: true },
];

function fmt(n, d = 2) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function OilPricePanel() {
  const { prices, priceHistory, scores } = useDashboard();

  const latestByCommodity = {};
  (prices || []).forEach((p) => { latestByCommodity[p.commodity] = p; });

  const hormuzScore = scores?.hormuz?.score ?? 0;
  const hormuzElevated = severityFromScore(hormuzScore) === 'stressed'
    || severityFromScore(hormuzScore) === 'disrupted';

  // Any fallback source active? (EIA key missing) — surface honestly.
  const usingFallback = (prices || []).some((p) => (p.source || '').includes('fallback'));

  function renderLive(bm) {
    const latest = latestByCommodity[bm.key];
    const hist = (priceHistory?.[bm.key] || []); // desc: newest first
    const series = [...hist].reverse().map((h) => Number(h.price)); // oldest → newest
    const current = latest ? Number(latest.price) : (series.length ? series[series.length - 1] : null);
    const prev = hist.length > 1 ? Number(hist[1].price) : null;

    let change = null; let pct = null; let dir = 'flat';
    if (current != null && prev != null) {
      change = current - prev;
      pct = prev !== 0 ? (change / prev) * 100 : 0;
      dir = change > 0.001 ? 'up' : change < -0.001 ? 'down' : 'flat';
    }

    return (
      <div className="oil-row" key={bm.key}>
        <div className="oil-id">
          <div className="oil-benchmark">{bm.label || bm.key}</div>
          <div className="oil-region">{bm.region}</div>
        </div>
        <Sparkline data={series} color={bm.color} />
        <div className="oil-figures">
          <div className="oil-price">
            {current != null ? `$${fmt(current)}` : '—'} <span className="op-unit">/bbl</span>
          </div>
          <div className={`oil-change ${dir}`}>
            {change != null
              ? `${change >= 0 ? '▲' : '▼'} ${change >= 0 ? '+' : ''}${fmt(change)} (${pct >= 0 ? '+' : ''}${fmt(pct, 1)}%)`
              : '24h —'}
          </div>
        </div>
      </div>
    );
  }

  function renderUnavailable(bm) {
    return (
      <div className="oil-row oil-unavailable" key={bm.key}>
        <div className="oil-id">
          <div className="oil-benchmark">{bm.label || bm.key}</div>
          <div className="oil-region">{bm.region}</div>
        </div>
        <span className="oil-na-badge">no free live source</span>
        <div className="oil-figures">
          <div className="oil-price">Data unavailable</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title">
        Crude Benchmarks
        <span className="pt-sub">Live spot · 7-day trend</span>
      </div>

      <div className="oil-panel">
        {BENCHMARKS.map((bm) => (bm.live ? renderLive(bm) : renderUnavailable(bm)))}
      </div>

      {hormuzElevated && (
        <div className="oil-context-note">
          <span aria-hidden>⚠</span>
          Gulf-linked benchmarks may be sensitive to elevated Strait of Hormuz corridor risk.
        </div>
      )}

      <div className="oil-source-line">
        Source: EIA Open Data (Brent · WTI){usingFallback ? ' - historical fallback rows detected; run ingest with a valid EIA_API_KEY' : ''}
      </div>
    </div>
  );
}
