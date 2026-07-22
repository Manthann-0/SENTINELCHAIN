'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend
);

const CORRIDOR_STYLES = {
  hormuz: {
    border: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    point: '#fbbf24',
  },
  red_sea: {
    border: '#14b8a6',
    bg: 'rgba(20,184,166,0.08)',
    point: '#2dd4bf',
  },
  malacca: {
    border: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    point: '#a78bfa',
  },
};

const CORRIDOR_LABELS = {
  hormuz: 'Hormuz',
  red_sea: 'Red Sea',
  malacca: 'Malacca',
};

export default function RiskTrendChart({ historyData }) {
  /**
   * historyData = {
   *   hormuz: [{score, computed_at}, ...],
   *   red_sea: [...],
   *   malacca: [...]
   * }
   */
  const chartRef = useRef(null);

  // Build unified time labels from all corridors
  const allDates = new Set();
  Object.values(historyData || {}).forEach(history => {
    (history || []).forEach(item => {
      const d = new Date(item.computed_at);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      allDates.add(label);
    });
  });

  // If no data, show placeholder dates
  const labels = allDates.size > 0
    ? [...allDates].reverse().slice(-14)
    : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

  const datasets = Object.entries(historyData || {}).map(([corridorId, history]) => {
    const style = CORRIDOR_STYLES[corridorId] || CORRIDOR_STYLES.hormuz;
    const scores = (history || []).reverse().slice(-14).map(h => h.score);

    // Pad with nulls if shorter than labels
    while (scores.length < labels.length) {
      scores.unshift(null);
    }

    return {
      label: CORRIDOR_LABELS[corridorId] || corridorId,
      data: scores,
      borderColor: style.border,
      backgroundColor: style.bg,
      pointBackgroundColor: style.point,
      pointBorderColor: style.border,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
    };
  });

  const data = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: 'easeInOutQuart',
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter, system-ui, sans-serif', size: 12 },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#1e1e2e',
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        borderColor: '#2a2a3e',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        titleFont: { family: 'Inter, system-ui, sans-serif', weight: '600' },
        bodyFont: { family: 'Inter, system-ui, sans-serif' },
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}/100`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255,255,255,0.04)',
          drawTicks: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter, system-ui, sans-serif', size: 11 },
          padding: 8,
        },
        border: { display: false },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(255,255,255,0.04)',
          drawTicks: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter, system-ui, sans-serif', size: 11 },
          padding: 12,
          stepSize: 25,
          callback: (val) => val,
        },
        border: { display: false },
      },
    },
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2 className="chart-title">Risk Trend</h2>
        <span className="chart-subtitle">7-day corridor risk scores</span>
      </div>
      <div className="chart-wrapper">
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
}
