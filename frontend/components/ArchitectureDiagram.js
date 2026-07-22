'use client';

/**
 * ArchitectureDiagram — SVG system architecture for SentinelChain.
 * Shows the full pipeline: Ingestion → Risk Agent → Scenario Modeller →
 * Network Twin → Procurement/Reserve → Dashboard, with Postgres + Chroma
 * as shared infrastructure.
 */
export default function ArchitectureDiagram() {
  const W = 880;
  const H = 340;

  // Color palette (matches design system)
  const C = {
    bg: '#0f0f18',
    card: '#16161f',
    border: '#2a2a3e',
    text: '#e2e8f0',
    muted: '#94a3b8',
    dim: '#64748b',
    amber: '#f59e0b',
    teal: '#2dd4bf',
    violet: '#a78bfa',
    green: '#4ade80',
    red: '#ef4444',
    blue: '#60a5fa',
  };

  const Box = ({ x, y, w, h, label, sublabel, color, icon }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={C.card} stroke={color} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sublabel ? 22 : 28)} textAnchor="middle" fill={C.text} fontSize="11" fontWeight="600">{icon} {label}</text>
      {sublabel && <text x={x + w / 2} y={y + 38} textAnchor="middle" fill={C.dim} fontSize="9">{sublabel}</text>}
    </g>
  );

  const Arrow = ({ x1, y1, x2, y2 }) => (
    <g>
      <line x1={x1} y1={y1} x2={x2 - 6} y2={y2} stroke={C.dim} strokeWidth={1.5} markerEnd="url(#arrowhead)" />
    </g>
  );

  return (
    <div className="architecture-diagram-container">
      <svg viewBox={`0 0 ${W} ${H}`} className="architecture-svg">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={C.dim} />
          </marker>
        </defs>

        {/* Title */}
        <text x={W / 2} y={20} textAnchor="middle" fill={C.text} fontSize="13" fontWeight="700">SentinelChain — System Architecture</text>

        {/* Row 1: Pipeline */}
        <Box x={10} y={40} w={120} h={50} label="Data Ingestion" sublabel="GDELT · EIA · OFAC · AIS" color={C.blue} icon="📡" />
        <Arrow x1={130} y1={65} x2={155} y2={65} />
        
        <Box x={155} y={40} w={130} h={50} label="Risk Intelligence" sublabel="Corridor + Supplier Scoring" color={C.amber} icon="🧠" />
        <Arrow x1={285} y1={65} x2={310} y2={65} />
        
        <Box x={310} y={40} w={130} h={50} label="Scenario Modeller" sublabel="5-Metric Cascade Engine" color={C.red} icon="⚡" />
        <Arrow x1={440} y1={65} x2={465} y2={65} />
        
        <Box x={465} y={40} w={130} h={50} label="Network Twin" sublabel="Impact Propagation" color={C.violet} icon="🌐" />
        <Arrow x1={595} y1={65} x2={620} y2={65} />
        
        <Box x={620} y={40} w={130} h={50} label="Procurement" sublabel="Ranking + Reserve Plan" color={C.teal} icon="📋" />
        <Arrow x1={750} y1={65} x2={775} y2={65} />
        
        <Box x={775} y={40} w={95} h={50} label="Dashboard" sublabel="Unified UI" color={C.green} icon="📊" />

        {/* Row 2: Infrastructure */}
        <rect x={155} y={120} width={560} height={55} rx={10} fill="rgba(255,255,255,0.02)" stroke={C.border} strokeWidth={1} strokeDasharray="4,4" />
        <text x={435} y={140} textAnchor="middle" fill={C.muted} fontSize="10" fontWeight="600">Shared Infrastructure</text>
        
        <Box x={200} y={145} w={140} h={24} label="Supabase (Postgres)" color={C.blue} icon="🗄️" />
        <Box x={370} y={145} w={140} h={24} label="ChromaDB (Vectors)" color={C.violet} icon="🔗" />
        <Box x={540} y={145} w={140} h={24} label="Gemini 3.1 Flash-Lite" color={C.amber} icon="✨" />

        {/* Vertical connections to infra */}
        <line x1={220} y1={90} x2={270} y2={120} stroke={C.border} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={375} y1={90} x2={375} y2={120} stroke={C.border} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={530} y1={90} x2={440} y2={120} stroke={C.border} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={685} y1={90} x2={610} y2={120} stroke={C.border} strokeWidth={1} strokeDasharray="3,3" />

        {/* Row 3: Data flow labels */}
        <text x={142} y={58} textAnchor="middle" fill={C.dim} fontSize="7">→</text>

        {/* Bottom: Key metrics */}
        <rect x={10} y={200} width={W - 20} height={130} rx={10} fill="rgba(255,255,255,0.015)" stroke={C.border} strokeWidth={1} />
        <text x={W / 2} y={220} textAnchor="middle" fill={C.muted} fontSize="10" fontWeight="600">Pipeline Outputs at Each Stage</text>
        
        {/* Stage outputs */}
        <g>
          <rect x={30} y={235} width={150} height={80} rx={6} fill={C.card} stroke={C.border} />
          <text x={105} y={253} textAnchor="middle" fill={C.amber} fontSize="9" fontWeight="600">Stage 1: Live Risk</text>
          <text x={105} y={268} textAnchor="middle" fill={C.dim} fontSize="8">• 3 Corridor scores (0-100)</text>
          <text x={105} y={280} textAnchor="middle" fill={C.dim} fontSize="8">• 5 Supplier scores</text>
          <text x={105} y={292} textAnchor="middle" fill={C.dim} fontSize="8">• Events, Prices, Vessels</text>
          <text x={105} y={304} textAnchor="middle" fill={C.dim} fontSize="8">• Sanctions monitoring</text>
        </g>
        <g>
          <rect x={200} y={235} width={150} height={80} rx={6} fill={C.card} stroke={C.border} />
          <text x={275} y={253} textAnchor="middle" fill={C.red} fontSize="9" fontWeight="600">Stage 2: Scenarios</text>
          <text x={275} y={268} textAnchor="middle" fill={C.dim} fontSize="8">• Refinery Run-Rate</text>
          <text x={275} y={280} textAnchor="middle" fill={C.dim} fontSize="8">• Price Premium</text>
          <text x={275} y={292} textAnchor="middle" fill={C.dim} fontSize="8">• SPR Days Remaining</text>
          <text x={275} y={304} textAnchor="middle" fill={C.dim} fontSize="8">• Power Stress + GDP</text>
        </g>
        <g>
          <rect x={370} y={235} width={150} height={80} rx={6} fill={C.card} stroke={C.border} />
          <text x={445} y={253} textAnchor="middle" fill={C.violet} fontSize="9" fontWeight="600">Stage 3: Network Twin</text>
          <text x={445} y={268} textAnchor="middle" fill={C.dim} fontSize="8">• 12 Supply chain nodes</text>
          <text x={445} y={280} textAnchor="middle" fill={C.dim} fontSize="8">• 14 Flow edges</text>
          <text x={445} y={292} textAnchor="middle" fill={C.dim} fontSize="8">• Stress propagation</text>
          <text x={445} y={304} textAnchor="middle" fill={C.dim} fontSize="8">• Interactive map</text>
        </g>
        <g>
          <rect x={540} y={235} width={150} height={80} rx={6} fill={C.card} stroke={C.border} />
          <text x={615} y={253} textAnchor="middle" fill={C.teal} fontSize="9" fontWeight="600">Stage 4: Procurement</text>
          <text x={615} y={268} textAnchor="middle" fill={C.dim} fontSize="8">• 5-factor ranking</text>
          <text x={615} y={280} textAnchor="middle" fill={C.dim} fontSize="8">• AI rationale (Gemini)</text>
          <text x={615} y={292} textAnchor="middle" fill={C.dim} fontSize="8">• SPR drawdown plan</text>
          <text x={615} y={304} textAnchor="middle" fill={C.dim} fontSize="8">• Reserve optimization</text>
        </g>
        <g>
          <rect x={710} y={235} width={140} height={80} rx={6} fill={C.card} stroke={C.border} />
          <text x={780} y={253} textAnchor="middle" fill={C.green} fontSize="9" fontWeight="600">Dashboard</text>
          <text x={780} y={268} textAnchor="middle" fill={C.dim} fontSize="8">• Unified 4-section UI</text>
          <text x={780} y={280} textAnchor="middle" fill={C.dim} fontSize="8">• 45s auto-refresh</text>
          <text x={780} y={292} textAnchor="middle" fill={C.dim} fontSize="8">• Dark command center</text>
          <text x={780} y={304} textAnchor="middle" fill={C.dim} fontSize="8">• Info tooltips</text>
        </g>
      </svg>
    </div>
  );
}
