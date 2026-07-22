'use client';

import { useDashboard } from './DashboardProvider';

const SLOTS = 30;

// Sources with a fixed, deterministic illustrative "recent runs" pattern. The
// right-most slot always reflects the CURRENT live health state; earlier slots
// are illustrative (we don't yet persist per-run history). Labeled as such.
const SOURCES = [
  { key: 'news', name: 'News & Events', src: 'GDELT / NewsAPI', blips: [11] },
  { key: 'ais', name: 'Vessel Tracking', src: 'AISHub credential required', blips: [] },
  { key: 'sanctions', name: 'Sanctions', src: 'OFAC SDN', blips: [] },
  { key: 'prices', name: 'Crude Prices', src: 'EIA Open Data', blips: [19] },
  { key: 'network', name: 'Network Data', src: 'Digital Twin', blips: [] },
];

function slotState(source, index, liveState) {
  if (index === SLOTS - 1) {
    // most recent slot = live
    return liveState === 'down' ? 'down' : liveState === 'degraded' ? 'degraded' : 'ok';
  }
  if (source.key === 'ais') return 'degraded'; // unavailable without AISHub credentials
  if (source.blips.includes(index)) return 'degraded';
  return 'ok';
}

export default function SystemStatusTimeline() {
  const { health } = useDashboard();

  return (
    <div className="panel">
      <div className="panel-title">
        Ingestion Uptime
        <span className="pt-sub">Recent runs · right-most = live</span>
      </div>

      {SOURCES.map((source) => {
        const live = health?.[source.key] || 'unknown';
        const slots = Array.from({ length: SLOTS }, (_, i) => slotState(source, i, live));
        const okCount = slots.filter((s) => s === 'ok').length;
        const pct = ((okCount / SLOTS) * 100).toFixed(1);
        return (
          <div className="uptime-source" key={source.key}>
            <div className="uptime-head">
              <span className="uptime-name">
                {source.name} <span className="un-src">{source.src}</span>
              </span>
              <span className="uptime-pct">{pct}% ok</span>
            </div>
            <div className="uptime-bar">
              {slots.map((s, i) => (
                <span key={i} className="uptime-slot" data-s={s} title={i === SLOTS - 1 ? 'Current run' : `Run -${SLOTS - 1 - i}`} />
              ))}
            </div>
            <div className="uptime-axis"><span>-{SLOTS - 1} runs</span><span>now</span></div>
          </div>
        );
      })}

      <p className="uptime-note">
        The right-most slot reflects the current live health check. Earlier slots are illustrative —
        per-run history is not yet persisted. AIS is shown as degraded when AISHub credentials are
        unavailable (see How This Works).
      </p>
    </div>
  );
}
