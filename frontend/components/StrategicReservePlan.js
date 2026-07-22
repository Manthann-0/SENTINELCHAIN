'use client';

import { useRef } from 'react';
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
import InfoTooltip from './InfoTooltip';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend
);

export default function StrategicReservePlan({ plan }) {
  const chartRef = useRef(null);

  if (!plan || plan.length === 0) return null;

  const labels = plan.map(p => `Day ${p.drawdown_day}`);
  const sprLevels = plan.map(p => p.spr_level_pct);
  const demandCoverage = plan.map(p => p.refinery_demand_covered_pct);

  const data = {
    labels,
    datasets: [
      {
        label: 'SPR Level Remaining (%)',
        data: sprLevels,
        borderColor: '#fbbf24', // Amber
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        pointBackgroundColor: '#f59e0b',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Refinery Demand Covered (%)',
        data: demandCoverage,
        borderColor: '#2dd4bf', // Teal
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        pointBackgroundColor: '#14b8a6',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyle: 'circle' }
      },
      tooltip: {
        backgroundColor: '#1e1e2e', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: '#2a2a3e', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
        ticks: { color: '#64748b', font: { size: 11 } }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        min: 0,
        max: 100,
        grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
        ticks: { color: '#64748b', font: { size: 11 }, stepSize: 25 },
        title: { display: true, text: 'SPR Level (%)', color: '#64748b' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        min: 0,
        max: 100,
        grid: { drawOnChartArea: false }, // only draw grid lines for one axis
        ticks: { color: '#64748b', font: { size: 11 }, stepSize: 25 },
        title: { display: true, text: 'Demand Covered (%)', color: '#64748b' }
      }
    },
  };

  return (
    <div className="strategic-reserve-section">
      <h3 className="subsection-title">
        Strategic Petroleum Reserve Drawdown Plan
        <InfoTooltip text="Projected day-by-day drawdown of India's SPR over the disruption gap + 15 day replenishment lag. Target floor is 3 days." />
      </h3>
      <div className="chart-container" style={{ height: '300px', marginTop: '1rem' }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
}
