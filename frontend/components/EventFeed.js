'use client';

import { useState } from 'react';

const CORRIDOR_COLORS = {
  hormuz: '#f59e0b',
  red_sea: '#14b8a6',
  malacca: '#8b5cf6',
};

const CORRIDOR_LABELS = {
  hormuz: 'Hormuz',
  red_sea: 'Red Sea',
  malacca: 'Malacca',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SeverityDot({ severity }) {
  let color = '#4ade80'; // green (low)
  if (severity >= 0.7) color = '#ef4444';      // red (high)
  else if (severity >= 0.4) color = '#f59e0b';  // amber (medium)

  return (
    <span
      className="severity-dot"
      style={{
        background: color,
        boxShadow: `0 0 6px ${color}88`,
      }}
    />
  );
}

export default function EventFeed({ events, activeCorridor, onRunIngestion }) {
  const [filter, setFilter] = useState('all');

  const corridors = ['all', 'hormuz', 'red_sea', 'malacca'];

  const displayCorridor = activeCorridor || filter;
  const filteredEvents = displayCorridor === 'all'
    ? events
    : events?.filter(e => e.corridor_id === displayCorridor);

  return (
    <div className="event-feed">
      <div className="event-feed-header">
        <h2 className="event-feed-title">Contributing Events</h2>
        <div className="event-filter-tabs">
          {corridors.map(c => (
            <button
              key={c}
              className={`event-filter-tab ${displayCorridor === c ? 'active' : ''}`}
              onClick={() => setFilter(c)}
              style={
                displayCorridor === c && c !== 'all'
                  ? { borderColor: CORRIDOR_COLORS[c], color: CORRIDOR_COLORS[c] }
                  : {}
              }
            >
              {c === 'all' ? 'All' : CORRIDOR_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="event-list">
        {(!filteredEvents || filteredEvents.length === 0) ? (
          <div className="event-empty">
            <span className="event-empty-icon">📡</span>
            <p>No events in the last 48 hours</p>
            <p className="event-empty-sub">Run ingestion to pull latest signals</p>
            {onRunIngestion && (
              <button className="btn-empty-cta" onClick={onRunIngestion}>
                Run Ingestion Now
              </button>
            )}
          </div>
        ) : (
          filteredEvents.slice(0, 30).map((event, idx) => (
            <div key={event.id || idx} className="event-item">
              <div className="event-item-left">
                <SeverityDot severity={event.severity ?? 0.5} />
                <div className="event-item-content">
                  <p className="event-headline">{event.headline}</p>
                  <div className="event-meta">
                    <span
                      className="event-corridor-tag"
                      style={{
                        color: CORRIDOR_COLORS[event.corridor_id] || '#94a3b8',
                        borderColor: (CORRIDOR_COLORS[event.corridor_id] || '#94a3b8') + '44',
                      }}
                    >
                      {CORRIDOR_LABELS[event.corridor_id] || event.corridor_id}
                    </span>
                    <span className="event-time">{timeAgo(event.event_at)}</span>
                  </div>
                </div>
              </div>
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-link"
                  title="Open source"
                >
                  ↗
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
