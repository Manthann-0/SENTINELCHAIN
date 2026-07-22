'use client';

// Dependency-free inline SVG sparkline. `data` = oldest → newest numbers.
export default function Sparkline({ data, color = 'var(--sev-normal)', width = 92, height = 34 }) {
  const pts = (data || []).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (pts.length < 2) {
    return <svg className="oil-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden />;
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y];
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height - pad} L${coords[0][0].toFixed(1)},${height - pad} Z`;
  const [lastX, lastY] = coords[coords.length - 1];
  const gid = `spark-${Math.round(coords[0][1] * 100)}-${pts.length}`;

  return (
    <svg className="oil-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
