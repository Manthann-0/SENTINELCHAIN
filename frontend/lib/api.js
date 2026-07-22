const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Fetch helper with error handling for SentinelChain API.
 */
async function apiFetch(endpoint, options = {}, fetchOptions = {}) {
  const url = `${API_BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const quiet = Boolean(fetchOptions.quiet);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      if (fetchOptions.acceptNotFound && res.status === 404) {
        return null;
      }
      if (quiet || method === 'GET') {
        return null;
      }
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    if (!quiet && method !== 'GET') {
      console.error(`API fetch failed for ${endpoint}:`, error);
    }
    if (quiet || method === 'GET') {
      return null;
    }
    throw error;
  }
}

// ─── Risk Endpoints ──────────────────────────────────────────────────────────

export async function getCurrentRisk() {
  return apiFetch('/api/risk/current', {}, { quiet: true });
}

export async function refreshRiskScores() {
  return apiFetch('/api/risk/refresh', { method: 'POST' }, { quiet: true });
}

export async function getRiskHistory(corridorId, days = 7) {
  return apiFetch(`/api/risk/${corridorId}/history?days=${days}`, {}, { quiet: true });
}

export async function getSupplierRisk() {
  return apiFetch('/api/risk/suppliers', {}, { quiet: true });
}

export async function getSupplierRiskHistory(supplier, days = 7) {
  return apiFetch(`/api/risk/suppliers/${supplier}/history?days=${days}`, {}, { quiet: true });
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function getEvents(corridorId = 'all', hours = 48) {
  return apiFetch(`/api/events/${corridorId}?hours=${hours}`, {}, { quiet: true });
}

// ─── Prices ──────────────────────────────────────────────────────────────────

export async function getLatestPrices() {
  return apiFetch('/api/prices/latest', {}, { quiet: true });
}

export async function getPriceHistory(commodity = 'Brent', limit = 8) {
  return apiFetch(`/api/prices/history?commodity=${encodeURIComponent(commodity)}&limit=${limit}`, {}, { quiet: true });
}

// ─── Vessels ─────────────────────────────────────────────────────────────────

export async function getVessels(corridorId = 'all') {
  return apiFetch(`/api/vessels/${corridorId}`, {}, { quiet: true });
}

// ─── Corridors ───────────────────────────────────────────────────────────────

export async function getCorridors() {
  return apiFetch('/api/corridors', {}, { quiet: true });
}

// ─── Ingestion ───────────────────────────────────────────────────────────────

export async function triggerIngestion() {
  return apiFetch('/api/ingestion/run', { method: 'POST' }, { quiet: true });
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return apiFetch('/api/health', {}, { quiet: true });
}

// ─── Scenario Simulator (Stage 2) ────────────────────────────────────────────

export async function getScenarios() {
  return apiFetch('/api/scenarios', {}, { quiet: true });
}

export async function runScenario(scenarioId) {
  const payload = { scenario_id: scenarioId };
  console.info('[Scenario API] POST /api/scenarios/{scenario_id}/run', payload);
  return apiFetch(`/api/scenarios/${scenarioId}/run`, { method: 'POST' }, { quiet: true });
}

export async function getScenarioImpact(scenarioId) {
  return apiFetch(`/api/scenarios/${scenarioId}/impact`, {}, { acceptNotFound: true, quiet: true });
}

// ─── Stage 3: Procurement & Reserves ─────────────────────────────────────────

export async function generateRecommendations(scenarioId) {
  const payload = { scenario_id: scenarioId };
  console.info('[Scenario API] POST /api/scenarios/{scenario_id}/recommend', payload);
  return apiFetch(`/api/scenarios/${scenarioId}/recommend`, { method: 'POST' }, { quiet: true });
}

export async function getRecommendations(scenarioId) {
  return apiFetch(`/api/scenarios/${scenarioId}/recommendations`, {}, { quiet: true });
}

export async function getReservePlan(scenarioId) {
  return apiFetch(`/api/scenarios/${scenarioId}/reserve_plan`, {}, { quiet: true });
}

// ─── Stage 4: Network Digital Twin ───────────────────────────────────────────

export async function getNetworkGraph() {
  return apiFetch('/api/network/graph', {}, { quiet: true });
}

export async function getNetworkImpact(scenarioId) {
  return apiFetch(`/api/network/impact/${scenarioId}`, {}, { quiet: true });
}

