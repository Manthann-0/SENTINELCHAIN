'use client';

import { useState, useEffect, useMemo } from 'react';
import { getCurrentRisk, getNetworkGraph, getNetworkImpact } from '@/lib/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAP_BOUNDS = {
  minLat: -8,
  maxLat: 36,
  minLon: 38,
  maxLon: 112,
};

const MAP_CENTER = [18.5, 66.5];

const BASE_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const BASE_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';

const NODE_LABELS = {
  import_terminal: 'Import Terminal',
  refinery: 'Refinery',
  distribution_hub: 'Distribution Hub',
};

const STATUS_COLORS = {
  normal: '#4ade80',
  stressed: '#fbbf24',
  disrupted: '#ef4444',
};

const STATUS_RING_COLORS = {
  normal: 'rgba(74, 222, 128, 0.35)',
  stressed: 'rgba(251, 191, 36, 0.45)',
  disrupted: 'rgba(239, 68, 68, 0.55)',
};

const CORRIDOR_BASE_COLORS = {
  hormuz: '#f59e0b',
  red_sea: '#14b8a6',
  malacca: '#8b5cf6',
};

const CORRIDOR_STATUS_COLORS = {
  normal: 'rgba(148, 163, 184, 0.35)',
  stressed: 'rgba(251, 191, 36, 0.62)',
  disrupted: 'rgba(239, 68, 68, 0.82)',
};

const EDGE_BASE_COLORS = {
  shipping_route: {
    normal: 'rgba(14, 165, 233, 0.62)',
    stressed: 'rgba(251, 191, 36, 0.75)',
    disrupted: 'rgba(239, 68, 68, 0.88)',
  },
  pipeline: {
    normal: 'rgba(148, 163, 184, 0.42)',
    stressed: 'rgba(251, 191, 36, 0.50)',
    disrupted: 'rgba(248, 113, 113, 0.65)',
  },
  distribution_link: {
    normal: 'rgba(100, 116, 139, 0.38)',
    stressed: 'rgba(251, 191, 36, 0.45)',
    disrupted: 'rgba(248, 113, 113, 0.60)',
  },
};

const NODE_ICON_SVGS = {
  import_terminal:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5c2.1-2 4.5-3 8-3s5.9 1 8 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 14h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 7.5h7L18 12H7l1.5-4.5Z" fill="currentColor" opacity="0.9"/><path d="M12 4.5v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  refinery:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 19V8l4 2.5V8l4 2.5V7l4 2v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 12h2M12 10.5h2M16 13h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  distribution_hub:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.5h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 18V9.5l6-3 6 3V18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 18v-4h4v4" fill="currentColor" opacity="0.85"/><path d="M9 10.5h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function riskToColor(score = 0) {
  const clamped = clamp(Number(score) || 0, 0, 100);
  const hue = 132 - (clamped * 1.32);
  const lightness = clamped > 70 ? 60 : clamped > 40 ? 56 : 52;
  return `hsl(${hue}, 82%, ${lightness}%)`;
}

function nodeStatusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.normal;
}

function nodeRingColor(status) {
  return STATUS_RING_COLORS[status] || STATUS_RING_COLORS.normal;
}

function edgeColor(edge) {
  const palette = EDGE_BASE_COLORS[edge.edge_type] || EDGE_BASE_COLORS.pipeline;
  return palette[edge.status || 'normal'] || palette.normal;
}

function createNodeIcon(leafletApi, node, isSelected = false) {
  if (!leafletApi) return null;

  const status = node.status || 'normal';
  const color = nodeStatusColor(status);
  const ring = nodeRingColor(status);
  const glyph = NODE_ICON_SVGS[node.node_type] || NODE_ICON_SVGS.distribution_hub;

  return leafletApi.divIcon({
    className: 'network-node-icon-wrapper',
    html: `
      <div class="network-node-icon network-node-icon--${node.node_type} network-node-icon--${status} ${isSelected ? 'is-selected' : ''}" style="--node-color:${color}; --node-ring:${ring};">
        <span class="network-node-icon__halo"></span>
        <span class="network-node-icon__glyph">${glyph}</span>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -18],
  });
}

function createLabelIcon(leafletApi, text, tone = 'default') {
  if (!leafletApi) return null;

  return leafletApi.divIcon({
    className: 'network-label-icon-wrapper',
    html: `<div class="network-label-badge network-label-badge--${tone}">${text}</div>`,
    iconSize: [170, 28],
    iconAnchor: [85, 26],
  });
}

function interpolateGreatCircle(start, end, segments = 28) {
  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;

  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lon);
  const lat2 = toRad(end.lat);
  const lon2 = toRad(end.lon);

  const delta = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
    ),
  );

  if (delta === 0) {
    return [start, end];
  }

  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const fraction = index / segments;
    const a = Math.sin((1 - fraction) * delta) / Math.sin(delta);
    const b = Math.sin(fraction * delta) / Math.sin(delta);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    points.push([toDeg(lat), toDeg(lon)]);
  }

  return points;
}

function buildMapBounds(graphData) {
  const points = [];
  graphData?.nodes?.forEach((node) => {
    if (typeof node.lat === 'number' && typeof node.lon === 'number') {
      points.push([node.lat, node.lon]);
    }
  });
  graphData?.corridor_origins && Object.values(graphData.corridor_origins).forEach((origin) => {
    if (typeof origin.lat === 'number' && typeof origin.lon === 'number') {
      points.push([origin.lat, origin.lon]);
    }
  });

  return points;
}

function formatBpd(val) {
  if (!val) return 'N/A';
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M bpd`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K bpd`;
  return `${val} bpd`;
}

function shouldShowLabel(node, zoom, selectedNodeId) {
  if (selectedNodeId === node.id) return true;
  if (node.node_type === 'import_terminal' || node.node_type === 'refinery') {
    return zoom >= 4.75;
  }
  return zoom >= 5.8;
}

function mapLabelPriority(node, selectedNodeId) {
  if (selectedNodeId === node.id) return 100;
  if (node.node_type === 'import_terminal') return 85;
  if (node.node_type === 'refinery') return 80;
  return 70;
}

function FitBounds({ bounds, leafletApi, useMapHook }) {
  const map = useMapHook();

  useEffect(() => {
    if (!bounds || bounds.length === 0 || !leafletApi) return;
    const leafletBounds = leafletApi.latLngBounds(bounds);
    map.fitBounds(leafletBounds, {
      padding: [40, 40],
      animate: true,
      duration: 0.6,
      maxZoom: 5.4,
    });
  }, [bounds, leafletApi, map]);

  return null;
}

function CollisionAwareLabels({ nodes, corridorOrigins, selectedNodeId, leafletApi, useMapHook, useMapEventsHook, PaneComponent, MarkerComponent }) {
  const map = useMapHook();
  const [, setViewportVersion] = useState(0);

  useMapEventsHook({
    zoomend: () => setViewportVersion((value) => value + 1),
    moveend: () => setViewportVersion((value) => value + 1),
    resize: () => setViewportVersion((value) => value + 1),
  });

  const zoom = map.getZoom();

  const visibleLabels = (() => {
    if (!map) return [];

    const candidates = [];

    Object.entries(corridorOrigins || {}).forEach(([corridorId, origin]) => {
      candidates.push({
        key: `corridor-${corridorId}`,
        text: origin.name,
        position: [origin.lat, origin.lon],
        tone: corridorId,
        priority: 95,
        box: [170, 28],
      });
    });

    nodes
      .filter((node) => shouldShowLabel(node, zoom, selectedNodeId))
      .forEach((node) => {
        const tone = node.status || 'normal';
        candidates.push({
          key: `node-${node.id}`,
          text: node.name,
          position: [node.lat, node.lon],
          tone,
          priority: mapLabelPriority(node, selectedNodeId),
          box: node.node_type === 'distribution_hub' ? [170, 24] : [180, 28],
        });
      });

    candidates.sort((a, b) => b.priority - a.priority);

    const accepted = [];
    const occupied = [];

    for (const candidate of candidates) {
      const point = map.latLngToContainerPoint(candidate.position);
      const width = candidate.box[0];
      const height = candidate.box[1];
      const box = {
        left: point.x - width / 2,
        right: point.x + width / 2,
        top: point.y - height - 4,
        bottom: point.y + 2,
      };

      const collides = occupied.some((existing) => !(
        box.right < existing.left ||
        box.left > existing.right ||
        box.bottom < existing.top ||
        box.top > existing.bottom
      ));

      if (!collides) {
        occupied.push(box);
        accepted.push(candidate);
      }
    }

    return accepted;
  })();

  return (
    <PaneComponent name="labels" style={{ zIndex: 680 }}>
      {visibleLabels.map((label) => (
        <MarkerComponent
          key={label.key}
          position={label.position}
          icon={createLabelIcon(leafletApi, label.text, label.tone)}
          interactive={false}
          keyboard={false}
        />
      ))}
    </PaneComponent>
  );
}

function NetworkLayers({
  graphData,
  impactData,
  liveRiskMap,
  selectedNodeId,
  setSelectedNodeId,
  leafletApi,
  leafletDeps,
}) {
  const map = leafletDeps.useMapHook();
  const [, setViewportVersion] = useState(0);

  leafletDeps.useMapEventsHook({
    zoomend: () => setViewportVersion((value) => value + 1),
    moveend: () => setViewportVersion((value) => value + 1),
  });

  const nodes = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const edges = useMemo(() => graphData?.edges ?? [], [graphData]);
  const corridorOrigins = useMemo(() => graphData?.corridor_origins ?? {}, [graphData]);
  const zoom = map.getZoom();
  const activeScenario = impactData?.scenario || null;
  const activeCorridorId = activeScenario?.corridor_id || null;

  const corridorFeatures = (() => {
    return Object.entries(corridorOrigins).map(([corridorId, origin]) => ({
      corridorId,
      origin,
      riskScore: impactData?.scenario?.corridor_id === corridorId
        ? clamp((impactData?.scenario?.disruption_pct || 0) * 100, 0, 100)
        : liveRiskMap[corridorId]?.score ?? 0,
      status: impactData?.scenario?.corridor_id === corridorId
        ? ((impactData?.scenario?.disruption_pct || 0) > 0.5 ? 'disrupted' : 'stressed')
        : 'normal',
    }));
  })();

  const nodeById = useMemo(() => {
    const lookup = new Map();
    nodes.forEach((node) => lookup.set(node.id, node));
    return lookup;
  }, [nodes]);

  const shippingRoutes = (() => {
    return edges
      .filter((edge) => edge.edge_type === 'shipping_route' && edge.corridor_id && corridorOrigins[edge.corridor_id])
      .map((edge) => {
        const origin = corridorOrigins[edge.corridor_id];
        const target = nodeById.get(edge.target_node_id);
        if (!origin || !target) return null;

        const path = interpolateGreatCircle(
          { lat: origin.lat, lon: origin.lon },
          { lat: target.lat, lon: target.lon },
          28,
        );

        const isScenarioAffect = activeCorridorId === edge.corridor_id;
        const corridorStatus = impactData?.edges?.find((item) => item.id === edge.id)?.status || edge.status || 'normal';

        return {
          id: edge.id,
          corridorId: edge.corridor_id,
          path,
          status: isScenarioAffect ? corridorStatus : (edge.status || 'normal'),
          active: isScenarioAffect,
          label: edge.label,
        };
      })
      .filter(Boolean);
  })();

  const supportEdges = (() => {
    return edges
      .filter((edge) => edge.edge_type !== 'shipping_route')
      .map((edge) => {
        const source = nodeById.get(edge.source_node_id);
        const target = nodeById.get(edge.target_node_id);
        if (!source || !target) return null;

        const path = interpolateGreatCircle(
          { lat: source.lat, lon: source.lon },
          { lat: target.lat, lon: target.lon },
          18,
        );

        return {
          id: edge.id,
          path,
          type: edge.edge_type,
          status: edge.status || 'normal',
        };
      })
      .filter(Boolean);
  })();

  const corridorMarkerSize = zoom >= 5.4 ? 18 : 15;

  return (
    <>
      <leafletDeps.PaneComponent name="supports" style={{ zIndex: 380 }}>
        {supportEdges.map((edge) => (
          <leafletDeps.PolylineComponent
            key={`support-${edge.id}`}
            positions={edge.path}
            pathOptions={{
              color: edgeColor(edge),
              weight: edge.type === 'pipeline' ? 2.25 : 1.7,
              opacity: edge.status === 'disrupted' ? 0.9 : 0.74,
              lineCap: 'round',
              dashArray: edge.type === 'distribution_link' ? '4 9' : '3 8',
              className: `network-route network-route--${edge.type} network-route--${edge.status}`,
            }}
          />
        ))}
      </leafletDeps.PaneComponent>

      <leafletDeps.PaneComponent name="shipping" style={{ zIndex: 430 }}>
        {shippingRoutes.map((edge) => (
          <leafletDeps.PolylineComponent
            key={`shipping-${edge.id}`}
            positions={edge.path}
            pathOptions={{
              color: edgeColor({ edge_type: 'shipping_route', status: edge.status }),
              weight: edge.active ? 3.6 : 2.8,
              opacity: edge.active ? 0.95 : 0.72,
              lineCap: 'round',
              dashArray: edge.status === 'disrupted' ? '8 7' : '12 9',
              className: [
                'network-route',
                'network-route--shipping',
                `network-route--${edge.status}`,
                edge.active ? 'network-route--active' : '',
              ].join(' '),
            }}
          />
        ))}
      </leafletDeps.PaneComponent>

      <leafletDeps.PaneComponent name="corridors" style={{ zIndex: 520 }}>
        {corridorFeatures.map(({ corridorId, origin, riskScore, status }) => {
          const riskColor = riskToColor(riskScore);
          const ringColor = status === 'normal'
            ? CORRIDOR_BASE_COLORS[corridorId] || riskColor
            : CORRIDOR_STATUS_COLORS[status];

          return (
            <leafletDeps.CircleMarkerComponent
              key={`corridor-${corridorId}`}
              center={[origin.lat, origin.lon]}
              radius={corridorMarkerSize}
              pathOptions={{
                color: ringColor,
                weight: 2,
                fillColor: riskColor,
                fillOpacity: 0.35,
                opacity: 1,
                className: [
                  'corridor-marker',
                  `corridor-marker--${status}`,
                  activeCorridorId === corridorId ? 'corridor-marker--active' : '',
                ].join(' '),
              }}
            >
              <leafletDeps.TooltipComponent direction="top" offset={[0, -4]} opacity={1} sticky>
                <span className="map-tooltip-title">{origin.name}</span>
                <span className="map-tooltip-subtitle">Risk: {Math.round(riskScore)}/100</span>
              </leafletDeps.TooltipComponent>
            </leafletDeps.CircleMarkerComponent>
          );
        })}
      </leafletDeps.PaneComponent>

      <leafletDeps.PaneComponent name="nodes" style={{ zIndex: 580 }}>
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isScenarioNode = activeCorridorId && node.corridor_id === activeCorridorId;
          const status = node.status || 'normal';

          return (
            <leafletDeps.MarkerComponent
              key={`node-${node.id}`}
              position={[node.lat, node.lon]}
              icon={createNodeIcon(leafletApi, node, isSelected)}
              eventHandlers={{
                click: () => {
                  console.info('[NetworkMap] selected node data', {
                    id: node.id,
                    name: node.name,
                    node_type: node.node_type,
                    capacity_bpd: node.capacity_bpd,
                    capacity_type: typeof node.capacity_bpd,
                    region: node.region,
                    region_type: typeof node.region,
                    status: node.status || 'normal',
                    status_type: typeof (node.status || 'normal'),
                    corridor_id: node.corridor_id,
                    raw: node,
                  });
                  setSelectedNodeId(node.id);
                },
              }}
              zIndexOffset={isSelected ? 1200 : isScenarioNode ? 300 : 0}
            >
              <leafletDeps.TooltipComponent
                direction="top"
                offset={[0, -6]}
                opacity={1}
                sticky
                className="node-hover-tooltip"
              >
                <span className="map-tooltip-title">{node.name}</span>
                <span className="map-tooltip-subtitle">{NODE_LABELS[node.node_type]}</span>
                <span className="map-tooltip-subtitle">Status: {status}</span>
              </leafletDeps.TooltipComponent>
            </leafletDeps.MarkerComponent>
          );
        })}
      </leafletDeps.PaneComponent>

      <CollisionAwareLabels
        nodes={nodes}
        corridorOrigins={corridorOrigins}
        selectedNodeId={selectedNodeId}
        leafletApi={leafletApi}
        useMapHook={leafletDeps.useMapHook}
        useMapEventsHook={leafletDeps.useMapEventsHook}
        PaneComponent={leafletDeps.PaneComponent}
        MarkerComponent={leafletDeps.MarkerComponent}
      />
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NetworkMap({ activeScenarioId }) {
  const [graphData, setGraphData] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [liveRiskMap, setLiveRiskMap] = useState({});
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [leafletApi, setLeafletApi] = useState(null);
  const [leafletDeps, setLeafletDeps] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaflet() {
      try {
        const [leafletModule, reactLeafletModule] = await Promise.all([
          import('leaflet'),
          import('react-leaflet'),
        ]);

        if (!cancelled) {
          const resolvedLeaflet = leafletModule.default || leafletModule;
          setLeafletApi(resolvedLeaflet);
          setLeafletDeps({
            MapContainerComponent: reactLeafletModule.MapContainer,
            MarkerComponent: reactLeafletModule.Marker,
            PaneComponent: reactLeafletModule.Pane,
            PolylineComponent: reactLeafletModule.Polyline,
            TileLayerComponent: reactLeafletModule.TileLayer,
            TooltipComponent: reactLeafletModule.Tooltip,
            ZoomControlComponent: reactLeafletModule.ZoomControl,
            CircleMarkerComponent: reactLeafletModule.CircleMarker,
            useMapHook: reactLeafletModule.useMap,
            useMapEventsHook: reactLeafletModule.useMapEvents,
          });
        }
      } catch (err) {
        console.error('Failed to load Leaflet client-side:', err);
      }
    }

    loadLeaflet();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const [graphRes, riskRes] = await Promise.allSettled([
          getNetworkGraph(),
          getCurrentRisk(),
        ]);

        if (graphRes.status === 'fulfilled' && graphRes.value?.status === 'ok') {
          setGraphData(graphRes.value);
        }

        if (riskRes.status === 'fulfilled' && riskRes.value?.status === 'ok') {
          const riskMap = {};
          riskRes.value.scores?.forEach((score) => {
            riskMap[score.corridor_id] = score;
          });
          setLiveRiskMap(riskMap);
        }
      } catch (err) {
        console.error('Failed to load network base data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchGraph();
  }, []);

  useEffect(() => {
    if (!activeScenarioId) {
      return;
    }

    async function fetchImpact() {
      try {
        const res = await getNetworkImpact(activeScenarioId);
        if (res.status === 'ok') {
          setImpactData(res);
        }
      } catch (err) {
        console.error('Failed to load network impact:', err);
      }
    }

    fetchImpact();
  }, [activeScenarioId]);

  const currentImpactData = impactData?.scenario?.id === activeScenarioId ? impactData : null;
  const displayData = currentImpactData || graphData;
  const fitBoundsPoints = useMemo(() => buildMapBounds(displayData), [displayData]);
  const activeSelectedNode = useMemo(
    () => displayData?.nodes?.find((node) => node.id === selectedNodeId) || null,
    [displayData, selectedNodeId],
  );

  if (isLoading) {
    return (
      <div className="network-map-container">
        <div className="skeleton-map"></div>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="network-map-container">
        <div className="empty-state">Network data unavailable</div>
      </div>
    );
  }

  const impactScenario = currentImpactData?.scenario || null;

  if (!leafletApi || !leafletDeps) {
    return (
      <div className="network-map-container">
        <div className="skeleton-map"></div>
      </div>
    );
  }

  return (
    <div className="network-map-container">
      <div className="map-legend">
        <div className="legend-item"><span className="legend-dot" style={{ background: '#4ade80' }}></span> Normal</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#fbbf24' }}></span> Stressed</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }}></span> Disrupted</div>
        <div className="legend-sep"></div>
        <div className="legend-item"><span className="legend-icon legend-icon--terminal"></span> Terminal</div>
        <div className="legend-item"><span className="legend-icon legend-icon--refinery"></span> Refinery</div>
        <div className="legend-item"><span className="legend-icon legend-icon--hub"></span> Dist. Hub</div>
      </div>

      {impactScenario && (
        <div className="map-scenario-badge">
          ⚡ Showing impact: <strong>{impactScenario.name}</strong>
          <span className="scenario-disruption">({(impactScenario.disruption_pct * 100).toFixed(0)}% disruption)</span>
        </div>
      )}

      <leafletDeps.MapContainerComponent
        center={MAP_CENTER}
        zoom={4.4}
        minZoom={3.4}
        maxZoom={8}
        zoomControl={false}
        scrollWheelZoom
        worldCopyJump={false}
        className="network-leaflet-map"
      >
        <leafletDeps.ZoomControlComponent position="topright" />
        <FitBounds bounds={fitBoundsPoints} leafletApi={leafletApi} useMapHook={leafletDeps.useMapHook} />

        <leafletDeps.TileLayerComponent
          url={BASE_TILE_URL}
          attribution={BASE_TILE_ATTRIBUTION}
          subdomains="abcd"
          opacity={0.96}
        />

        <NetworkLayers
          graphData={displayData}
          impactData={currentImpactData}
          liveRiskMap={liveRiskMap}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          leafletApi={leafletApi}
          leafletDeps={leafletDeps}
        />
      </leafletDeps.MapContainerComponent>

      {activeSelectedNode && (
        <div className="node-detail-panel" onClick={(e) => e.stopPropagation()}>
          <div className="node-detail-header">
            <span
              className="node-icon node-icon--svg"
              dangerouslySetInnerHTML={{
                __html: NODE_ICON_SVGS[activeSelectedNode.node_type] || NODE_ICON_SVGS.distribution_hub,
              }}
            />
            <div className="node-detail-title-block">
              <div className="node-detail-title-row">
                <h4>{activeSelectedNode.name}</h4>
                <span className="node-selected-chip">Selected</span>
              </div>
              <span className="node-type-badge">{NODE_LABELS[activeSelectedNode.node_type]}</span>
            </div>
            <button className="btn-close-panel" onClick={() => setSelectedNode(null)} aria-label="Close node details">×</button>
          </div>
          <div className="node-detail-mini-map">
            <span className="node-detail-mini-map__ring"></span>
            <span className="node-detail-mini-map__dot"></span>
            <div>
              <strong>{activeSelectedNode.region || 'Regional node'}</strong>
              <span>{activeSelectedNode.corridor_id ? activeSelectedNode.corridor_id.replace('_', ' ') : 'Domestic support node'}</span>
            </div>
          </div>
          <div className="node-detail-stats">
            <div className="node-stat">
              <span className="stat-label">Capacity</span>
              <span className="stat-value">{formatBpd(activeSelectedNode.capacity_bpd)}</span>
            </div>
            {activeSelectedNode.corridor_id && (
              <div className="node-stat">
                <span className="stat-label">Corridor</span>
                <span className="stat-value">{activeSelectedNode.corridor_id.replace('_', ' ')}</span>
              </div>
            )}
            {activeSelectedNode.region && (
              <div className="node-stat">
                <span className="stat-label">Region</span>
                <span className="stat-value">{activeSelectedNode.region}</span>
              </div>
            )}
            <div className="node-stat">
              <span className="stat-label">Status</span>
              <span className={`stat-value status-${activeSelectedNode.status || 'normal'}`}>
                {(activeSelectedNode.status || 'normal').toUpperCase()}
              </span>
            </div>
            {activeSelectedNode.stress > 0 && (
              <div className="node-stat">
                <span className="stat-label">Stress Level</span>
                <span className="stat-value">{activeSelectedNode.stress.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
