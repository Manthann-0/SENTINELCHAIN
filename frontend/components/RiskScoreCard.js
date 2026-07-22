'use client';

import { useState, useEffect, useRef } from 'react';
import InfoTooltip from '@/components/InfoTooltip';

/* ── corridor accent colors ───────────────────────────────────────────────── */
const COLORS = {
  hormuz:  { accent: '#f59e0b', glow: 'rgba(245,158,11,0.15)', text: '#fbbf24', bg: 'rgba(245,158,11,0.08)' },
  red_sea: { accent: '#14b8a6', glow: 'rgba(20,184,166,0.15)', text: '#2dd4bf', bg: 'rgba(20,184,166,0.08)' },
  malacca: { accent: '#8b5cf6', glow: 'rgba(139,92,246,0.15)', text: '#a78bfa', bg: 'rgba(139,92,246,0.08)' },
};

const CORRIDOR_LABELS = {
  hormuz:  'HORMUZ',
  red_sea: 'RED SEA',
  malacca: 'MALACCA',
};

/* ── animated number counter ──────────────────────────────────────────────── */
function AnimatedScore({ value, color }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    prev.current = end;
  }, [value]);

  return (
    <span
      className="score-number"
      style={{ color, fontVariantNumeric: 'tabular-nums' }}
    >
      {display}
    </span>
  );
}

/* ── trend indicator ──────────────────────────────────────────────────────── */
function TrendIndicator({ history }) {
  if (!history || history.length < 2) {
    return <span className="trend-indicator neutral">─ 0</span>;
  }

  const latest = history[0]?.score ?? 0;
  const previous = history[1]?.score ?? latest;
  const delta = latest - previous;

  if (delta > 0) {
    return <span className="trend-indicator up">▲ +{delta.toFixed(0)}</span>;
  } else if (delta < 0) {
    return <span className="trend-indicator down">▼ {delta.toFixed(0)}</span>;
  }
  return <span className="trend-indicator neutral">─ 0</span>;
}

/* ── risk level bar ───────────────────────────────────────────────────────── */
function RiskBar({ score, color }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="risk-bar-track">
      <div
        className="risk-bar-fill"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}44, ${color})`,
          boxShadow: `0 0 12px ${color}66`,
          transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

/* ── risk level label ─────────────────────────────────────────────────────── */
function riskLabel(score) {
  if (score >= 75) return { text: 'CRITICAL', cls: 'risk-critical' };
  if (score >= 50) return { text: 'ELEVATED', cls: 'risk-elevated' };
  if (score >= 30) return { text: 'MODERATE', cls: 'risk-moderate' };
  return { text: 'LOW', cls: 'risk-low' };
}

/* ── main export ──────────────────────────────────────────────────────────── */
export default function RiskScoreCard({ corridorId, score, history, onClick, isActive }) {
  const colors = COLORS[corridorId] || COLORS.hormuz;
  const label = CORRIDOR_LABELS[corridorId] || corridorId.toUpperCase();
  const level = riskLabel(score?.score ?? 0);
  const currentScore = score?.score ?? 0;

  return (
    <button
      className={`risk-card ${isActive ? 'risk-card-active' : ''}`}
      onClick={() => onClick?.(corridorId)}
      style={{
        '--card-accent': colors.accent,
        '--card-glow': colors.glow,
        '--card-bg': colors.bg,
        borderColor: isActive ? colors.accent : 'var(--border)',
        boxShadow: isActive ? `0 0 20px ${colors.glow}, 0 0 60px ${colors.glow}` : 'none',
      }}
    >
      {/* Header */}
      <div className="risk-card-header">
        <div className="corridor-label-row">
          <div className="corridor-dot" style={{ background: colors.accent }} />
          <span className="corridor-label">{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className={`risk-level-badge ${level.cls}`}>{level.text}</span>
          <InfoTooltip text="Score out of 100 based on recent events, sanctions, and asset risks." />
        </div>
      </div>

      {/* Score */}
      <div className="risk-card-score">
        <AnimatedScore value={currentScore} color={colors.text} />
        <span className="score-max">/100</span>
      </div>

      {/* Trend */}
      <div className="risk-card-trend">
        <TrendIndicator history={history} />
        <span className="trend-period">24h</span>
      </div>

      {/* Bar */}
      <RiskBar score={currentScore} color={colors.accent} />

      {/* Subtitle */}
      {score?.source_summary && (
        <p className="risk-card-summary">{score.source_summary}</p>
      )}
    </button>
  );
}
