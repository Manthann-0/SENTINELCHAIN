'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  getCurrentRisk,
  refreshRiskScores,
  getRiskHistory,
  getSupplierRisk,
  getSupplierRiskHistory,
  getEvents,
  getLatestPrices,
  getPriceHistory,
  getVessels,
  triggerIngestion,
  getScenarios,
  getScenarioImpact,
  runScenario,
  generateRecommendations,
  healthCheck,
} from '@/lib/api';
import { CORRIDORS, SUPPLIERS, severityFromScore } from '@/lib/severity';

const POLL_INTERVAL = 45000; // 45s
const PRICE_SERIES = ['Brent', 'WTI'];

const DashboardContext = createContext(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

export function DashboardProvider({ children }) {
  // ── Live data ──────────────────────────────────────────────────────────
  const [scores, setScores] = useState({});
  const [history, setHistory] = useState({});
  const [supplierScores, setSupplierScores] = useState({});
  const [supplierHistory, setSupplierHistory] = useState({});
  const [events, setEvents] = useState([]);
  const [prices, setPrices] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [vesselCounts, setVesselCounts] = useState({});
  const [health, setHealth] = useState({
    news: 'unknown', ais: 'unknown', sanctions: 'unknown', prices: 'unknown', network: 'unknown',
  });

  const [lastRefresh, setLastRefresh] = useState(null);
  const [lastIngestion, setLastIngestion] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Scenario / strategy (shared across routes) ───────────────────────────
  const [scenarios, setScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [scenarioImpact, setScenarioImpact] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [reservePlan, setReservePlan] = useState([]);
  const [procLoading, setProcLoading] = useState(false);
  const [procError, setProcError] = useState(null);

  // ── UI: sidebar collapse (persisted for the session) ─────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted UI + active scenario from sessionStorage (client only).
  useEffect(() => {
    try {
      const c = sessionStorage.getItem('sc.sidebar');
      if (c != null) setSidebarCollapsed(c === '1');
      const s = sessionStorage.getItem('sc.scenario');
      if (s != null && s !== '') setActiveScenarioId(Number(s));
    } catch { /* no-op */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem('sc.sidebar', sidebarCollapsed ? '1' : '0'); } catch { /* no-op */ }
  }, [sidebarCollapsed, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (activeScenarioId == null) sessionStorage.removeItem('sc.scenario');
      else sessionStorage.setItem('sc.scenario', String(activeScenarioId));
    } catch { /* no-op */ }
  }, [activeScenarioId, hydrated]);

  // ── Fetch all live data ──────────────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    try {
      const [
        riskRes, supplierRiskRes, eventsRes, pricesRes, healthRes, scenariosRes,
        ...rest
      ] = await Promise.allSettled([
        getCurrentRisk(),
        getSupplierRisk(),
        getEvents('all'),
        getLatestPrices(),
        healthCheck(),
        getScenarios(),
        ...CORRIDORS.map((c) => getRiskHistory(c)),
        ...SUPPLIERS.map((s) => getSupplierRiskHistory(s)),
        ...PRICE_SERIES.map((c) => getPriceHistory(c, 8)),
      ]);

      if (riskRes.status === 'fulfilled' && riskRes.value?.scores) {
        const m = {};
        riskRes.value.scores.forEach((s) => { m[s.corridor_id] = s; });
        setScores(m);
      }
      if (supplierRiskRes.status === 'fulfilled' && supplierRiskRes.value?.scores) {
        const m = {};
        supplierRiskRes.value.scores.forEach((s) => { m[s.supplier_country] = s; });
        setSupplierScores(m);
      }
      if (eventsRes.status === 'fulfilled' && eventsRes.value?.events) {
        setEvents(eventsRes.value.events);
      }
      if (pricesRes.status === 'fulfilled' && pricesRes.value?.prices) {
        setPrices(pricesRes.value.prices);
      }
      if (scenariosRes.status === 'fulfilled' && scenariosRes.value?.scenarios) {
        setScenarios(scenariosRes.value.scenarios);
      }

      // Per-source health. API reachable ⇒ live sources ok; AIS is mock data
      // (see How This Works) so it is reported as degraded rather than green.
      const apiUp = healthRes.status === 'fulfilled' && healthRes.value?.status === 'ok';
      const hasLivePrices = pricesRes.status === 'fulfilled'
        && Array.isArray(pricesRes.value?.prices)
        && pricesRes.value.prices.length > 0;
      const hasFallbackPrices = (pricesRes.status === 'fulfilled' && pricesRes.value?.prices)
        ? pricesRes.value.prices.some((p) => (p.source || '').includes('fallback'))
        : false;
      setHealth(apiUp
        ? { news: 'ok', ais: 'degraded', sanctions: 'ok', prices: hasLivePrices && !hasFallbackPrices ? 'ok' : 'degraded', network: 'ok' }
        : { news: 'down', ais: 'down', sanctions: 'down', prices: 'down', network: 'down' });

      // Split the tail of history / price responses.
      let i = 0;
      const hMap = {};
      CORRIDORS.forEach((cid) => {
        const r = rest[i++];
        hMap[cid] = (r?.status === 'fulfilled' && r.value?.history) ? r.value.history : [];
      });
      setHistory(hMap);

      const shMap = {};
      SUPPLIERS.forEach((sup) => {
        const r = rest[i++];
        shMap[sup] = (r?.status === 'fulfilled' && r.value?.history) ? r.value.history : [];
      });
      setSupplierHistory(shMap);

      const phMap = {};
      PRICE_SERIES.forEach((c) => {
        const r = rest[i++];
        phMap[c] = (r?.status === 'fulfilled' && r.value?.history) ? r.value.history : [];
      });
      setPriceHistory(phMap);

      // Vessel counts (non-critical).
      try {
        const vd = {};
        for (const cid of CORRIDORS) {
          const vRes = await getVessels(cid);
          vd[cid] = vRes?.count ?? 0;
        }
        setVesselCounts(vd);
      } catch { /* non-critical */ }

      setLastRefresh(new Date().toISOString());
      setIsLoaded(true);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const t = setInterval(fetchAllData, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchAllData]);

  // ── Scenario strategy fetch (impact + procurement + reserve) ─────────────
  useEffect(() => {
    if (activeScenarioId == null) {
      setScenarioImpact(null);
      setRecommendations([]);
      setReservePlan([]);
      setProcError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setProcLoading(true);
      setProcError(null);
      try {
        let impRes = await getScenarioImpact(activeScenarioId);
        if (!impRes?.impact) {
          impRes = await runScenario(activeScenarioId);
        }
        const recRes = await generateRecommendations(activeScenarioId);
        if (cancelled) return;
        if (impRes?.impact) {
          setScenarioImpact(impRes.impact);
        }
        if (recRes?.status === 'ok') {
          setRecommendations(recRes.recommendations || []);
          setReservePlan(recRes.reserve_plan || []);
        }
      } catch (err) {
        if (!cancelled) setProcError('Failed to load scenario strategy.');
      } finally {
        if (!cancelled) setProcLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeScenarioId]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshRiskScores();
      await fetchAllData();
    } catch (err) {
      console.error('Refresh failed:', err);
    }
    setIsRefreshing(false);
  }, [fetchAllData]);

  const runIngestion = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await triggerIngestion();
      setLastIngestion(new Date().toISOString());
      await refreshRiskScores();
      await fetchAllData();
    } catch (err) {
      console.error('Ingestion failed:', err);
    }
    setIsRefreshing(false);
  }, [fetchAllData]);

  const setActiveScenario = useCallback((id, impact = null) => {
    if (impact) setScenarioImpact(impact);
    setActiveScenarioId(id);
  }, []);

  const clearScenario = useCallback(() => {
    setActiveScenarioId(null);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  // ── Derived summaries ─────────────────────────────────────────────────────
  const highestCorridor = useMemo(() => {
    let best = null;
    Object.entries(scores).forEach(([id, s]) => {
      const score = s?.score ?? 0;
      if (!best || score > best.score) {
        best = { id, score, data: s, severity: severityFromScore(score) };
      }
    });
    return best;
  }, [scores]);

  const highestSupplier = useMemo(() => {
    let best = null;
    Object.entries(supplierScores).forEach(([name, s]) => {
      const score = s?.score ?? 0;
      if (!best || score > best.score) {
        best = { name, score, data: s, severity: severityFromScore(score) };
      }
    });
    return best;
  }, [supplierScores]);

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) || null,
    [scenarios, activeScenarioId],
  );

  const analysisAlert = useMemo(() => {
    const baselineMatch = (summary) => {
      if (!summary) return false;
      const text = String(summary).toLowerCase();
      return text.includes('baseline structural risk') || text.includes('gemini api was unavailable') || text.includes('baseline risk for');
    };

    const corridorIssues = Object.entries(scores)
      .filter(([, score]) => score?.analysis_status === 'unavailable' || baselineMatch(score?.source_summary) || baselineMatch(score?.justification))
      .map(([corridorId, score]) => ({
        id: corridorId,
        name: score?.corridor_name || corridorId,
        statusCode: score?.analysis_status_code ?? null,
        summary: score?.source_summary || score?.justification || '',
      }));

    const supplierIssues = Object.entries(supplierScores)
      .filter(([, score]) => score?.analysis_status === 'unavailable' || baselineMatch(score?.source_summary) || baselineMatch(score?.justification))
      .map(([supplier, score]) => ({
        id: supplier,
        name: supplier,
        statusCode: score?.analysis_status_code ?? null,
        summary: score?.source_summary || score?.justification || '',
      }));

    const affected = [...corridorIssues, ...supplierIssues];
    if (affected.length === 0) {
      return { status: 'ok', title: 'Gemini analysis live', message: 'Current corridor and supplier scores are analysis-backed.', affected: [] };
    }

    return {
      status: 'degraded',
      title: 'Gemini analysis unavailable for some scores',
      message: 'The app is currently showing baseline fallbacks for one or more scores. Check the backend Gemini call logs for the exact failure.',
      affected,
    };
  }, [scores, supplierScores]);

  const eventCounts = useMemo(() => {
    const counts = { hormuz: 0, red_sea: 0, malacca: 0 };
    (events || []).forEach((e) => {
      if (counts[e.corridor_id] != null) counts[e.corridor_id] += 1;
    });
    return counts;
  }, [events]);

  const value = {
    // data
    scores, history, supplierScores, supplierHistory, events, eventCounts,
    prices, priceHistory, vesselCounts, health,
    lastRefresh, lastIngestion, isRefreshing, isLoaded,
    // scenario/strategy
    scenarios, activeScenarioId, activeScenario, scenarioImpact,
    recommendations, reservePlan, procLoading, procError,
    // ui
    sidebarCollapsed, hydrated,
    analysisAlert,
    // derived
    highestCorridor, highestSupplier,
    // actions
    refresh, runIngestion, setActiveScenario, clearScenario, toggleSidebar,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
