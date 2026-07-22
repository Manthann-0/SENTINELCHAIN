'use client';

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

export default function VesselCount({ vesselData }) {
  /**
   * vesselData = { hormuz: 10, red_sea: 6, malacca: 4 }
   */
  const corridors = ['hormuz', 'red_sea', 'malacca'];

  return (
    <div className="vessel-widget">
      <div className="vessel-header">
        <span className="vessel-icon">🚢</span>
        <span className="vessel-title">Vessels Tracked</span>
      </div>
      <div className="vessel-counts">
        {corridors.map(cid => (
          <div key={cid} className="vessel-count-item">
            <span
              className="vessel-count-dot"
              style={{ background: CORRIDOR_COLORS[cid] }}
            />
            <span className="vessel-count-label">{CORRIDOR_LABELS[cid]}</span>
            <span className="vessel-count-value">
              {vesselData?.[cid] ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
