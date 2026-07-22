'use client';

import { useDashboard } from './DashboardProvider';
import { CORRIDOR_META, CORRIDORS, severityFromScore, SEV_COLOR } from '@/lib/severity';

function delta24h(hist) {
  if (!hist || hist.length < 2) return 0;
  return (hist[0]?.score ?? 0) - (hist[1]?.score ?? 0);
}

export default function CorridorComparisonTable({ activeCorridor, onSelect }) {
  const { scores, history, vesselCounts, eventCounts } = useDashboard();

  const rows = CORRIDORS.map((cid) => {
    const score = scores?.[cid]?.score ?? 0;
    return {
      cid,
      score,
      sev: severityFromScore(score),
      delta: delta24h(history?.[cid]),
      vessels: vesselCounts?.[cid] ?? 0,
      events: eventCounts?.[cid] ?? 0,
    };
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="panel">
      <div className="panel-title">
        Corridor Comparison
        <span className="pt-sub">All three chokepoints, side by side</span>
      </div>
      <table className="cmp-table">
        <thead>
          <tr>
            <th>Corridor</th>
            <th>Risk</th>
            <th>24h Δ</th>
            <th>Vessels</th>
            <th>Events</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const dir = r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'flat';
            return (
              <tr
                key={r.cid}
                onClick={() => onSelect?.(activeCorridor === r.cid ? null : r.cid)}
                style={activeCorridor === r.cid ? { background: 'var(--bg-card-hover)' } : undefined}
              >
                <td>
                  <span className="cmp-corridor">
                    <span className="cc-dot" style={{ background: CORRIDOR_META[r.cid]?.color }} />
                    {CORRIDOR_META[r.cid]?.short || r.cid}
                  </span>
                </td>
                <td>
                  <span className="cmp-score" style={{ color: SEV_COLOR[r.sev] }}>{Math.round(r.score)}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> /100</span>
                </td>
                <td className={`cmp-delta ${dir}`}>
                  {r.delta > 0 ? '▲ +' : r.delta < 0 ? '▼ ' : '─ '}{r.delta !== 0 ? Math.abs(r.delta).toFixed(0) : '0'}
                </td>
                <td>{r.vessels}</td>
                <td>{r.events}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
