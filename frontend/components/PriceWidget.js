'use client';

export default function PriceWidget({ prices }) {
  if (!prices || prices.length === 0) {
    return (
      <div className="price-widget">
        <div className="price-item">
          <span className="price-label">Brent</span>
          <span className="price-value">—</span>
        </div>
        <div className="price-divider" />
        <div className="price-item">
          <span className="price-label">WTI</span>
          <span className="price-value">—</span>
        </div>
      </div>
    );
  }

  return (
    <div className="price-widget">
      {prices.map((p, idx) => (
        <div key={p.commodity} className="price-item-wrapper">
          {idx > 0 && <div className="price-divider" />}
          <div className="price-item">
            <div className="price-top-row">
              <span className="price-label">{p.commodity}</span>
              <span className="price-source">{p.source || 'EIA'}</span>
            </div>
            <div className="price-bottom-row">
              <span className="price-value">
                ${Number(p.price).toFixed(2)}
              </span>
              <span className="price-unit">/bbl</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
