'use client';

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

const AXES = [
  { key: 'price_score', label: 'Price' },
  { key: 'distance_score', label: 'Dist/Risk' },
  { key: 'tanker_availability_score', label: 'Tanker' },
  { key: 'port_congestion_score', label: 'Port' },
  { key: 'compatibility_score', label: 'Grade' },
];

// Radar/spider is genuinely better than 5 separate bars for reading a
// multi-factor profile at a glance — a legitimate alternate visual.
export default function RecommendationRadar({ rec, color = '#2dd4bf' }) {
  if (!rec) return null;

  const data = {
    labels: AXES.map((a) => a.label),
    datasets: [
      {
        label: rec.source_country,
        data: AXES.map((a) => Number(rec[a.key] ?? 0)),
        backgroundColor: `${color}22`,
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2130',
        titleColor: '#e6edf6',
        bodyColor: '#9aa7b8',
        borderColor: '#2c3648',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.r.toFixed(1)}/100` },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        angleLines: { color: 'rgba(255,255,255,0.06)' },
        grid: { color: 'rgba(255,255,255,0.07)' },
        pointLabels: { color: '#9aa7b8', font: { size: 11, family: 'Space Grotesk, sans-serif' } },
        ticks: { display: false, stepSize: 25 },
      },
    },
  };

  return (
    <div className="radar-wrap">
      <Radar data={data} options={options} />
    </div>
  );
}
