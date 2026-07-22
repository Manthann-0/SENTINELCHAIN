'use client';

import { useState } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function StatusBar({ lastRefresh, onRefresh, onRunIngestion, isRefreshing, onResetDemo, lastIngestion }) {
  return (
    <header className="status-bar">
      <div className="status-bar-left">
        <div className="logo-group">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="logo-text">
            SENTINEL<span className="logo-accent">CHAIN</span>
          </h1>
        </div>
        <div className="status-live-badge">
          <span className="status-pulse" />
          <span>Live</span>
        </div>
        
        {/* Health Indicators */}
        <div className="health-indicators">
          <div className="health-dot-wrap">
            <span className="health-dot">🟢</span> News
          </div>
          <div className="health-dot-wrap">
            <span className="health-dot">🟢</span> AIS
          </div>
          <div className="health-dot-wrap">
            <span className="health-dot">🟢</span> Sanctions
          </div>
          <div className="health-dot-wrap">
            <span className="health-dot">🟢</span> Prices
          </div>
          <div className="health-dot-wrap">
            <span className="health-dot">🟢</span> Network
          </div>
        </div>
      </div>

      <div className="status-bar-right">
        {onResetDemo && (
          <button className="btn-reset" onClick={onResetDemo}>
            ↺ Reset Demo
          </button>
        )}
        <span className="status-refresh-time">
          Last Ingestion: {timeAgo(lastIngestion)}
        </span>
        <span className="status-refresh-time" style={{ marginLeft: '0.75rem' }}>
          Last Score: {timeAgo(lastRefresh)}
        </span>
        <button
          className="status-btn status-btn-secondary"
          onClick={onRunIngestion}
          disabled={isRefreshing}
          title="Pull latest data from all sources"
        >
          📡 Ingest
        </button>
        <button
          className="status-btn status-btn-primary"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <span className="btn-spinner" />
          ) : (
            '⟳'
          )}
          {isRefreshing ? 'Scoring...' : 'Refresh Scores'}
        </button>
      </div>
    </header>
  );
}
