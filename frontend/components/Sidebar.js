'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboard } from './DashboardProvider';
import { SEV_COLOR, SEV_LABEL } from '@/lib/severity';

/* ── Inline icon set (18px, currentColor) ─────────────────────────────────── */
const I = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  corridor: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  ),
  supplier: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V8l6-4 6 4v13" /><path d="M15 21V11l6 3v7" /><path d="M7 12h.01M7 16h.01" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="6" r="2.2" /><circle cx="19" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" />
      <path d="M7 7l4 9M17 7l-4 9M7 6h10" />
    </svg>
  ),
  scenario: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  recommend: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.2 1 2v.5h6v-.5c0-.8.3-1.4 1-2A6 6 0 0 0 12 3Z" />
    </svg>
  ),
  reserve: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </svg>
  ),
};

const NAV_GROUPS = [
  {
    label: null,
    items: [{ href: '/', key: 'overview', label: 'Overview', icon: I.overview }],
  },
  {
    label: 'Risk Monitoring',
    items: [
      { href: '/corridors', key: 'corridors', label: 'Corridor Risk', icon: I.corridor, sev: true },
      { href: '/suppliers', key: 'suppliers', label: 'Supplier Risk', icon: I.supplier },
      { href: '/network', key: 'network', label: 'Network Map / Digital Twin', icon: I.network },
    ],
  },
  {
    label: 'Response Planning',
    items: [
      { href: '/scenarios', key: 'scenarios', label: 'Scenario Simulator', icon: I.scenario },
      { href: '/recommendations', key: 'recommendations', label: 'Recommendations', icon: I.recommend },
      { href: '/reserve', key: 'reserve', label: 'Reserve Plan', icon: I.reserve },
    ],
  },
  {
    label: 'System',
    items: [{ href: '/system', key: 'system', label: 'System Status', icon: I.system }],
  },
];

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function isActive(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed, toggleSidebar,
    lastRefresh, lastIngestion, isRefreshing,
    refresh, runIngestion,
    highestCorridor, activeScenario, clearScenario,
  } = useDashboard();

  const sev = highestCorridor?.severity || 'normal';

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-header">
        <Link href="/" className="sidebar-brand" aria-label="SentinelChain home">
          <span className="sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="sidebar-wordmark">SENTINEL<span>CHAIN</span></span>
        </Link>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && <div className="sidebar-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.sev && (
                    <span
                      className="sev-dot"
                      style={{ background: SEV_COLOR[sev], color: SEV_COLOR[sev] }}
                      title={`Highest corridor severity: ${SEV_LABEL[sev]}`}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {activeScenario && (
          <div className="scenario-chip" title={`Active scenario: ${activeScenario.name}`}>
            <span className="sc-dot" />
            <span className="sc-name">{activeScenario.name}</span>
            <button className="sc-clear" onClick={clearScenario} aria-label="Clear active scenario">×</button>
          </div>
        )}

        <div className="footer-expanded footer-refresh">
          <div>Scores: <span className="fr-val">{timeAgo(lastRefresh)}</span></div>
          <div>Ingest: <span className="fr-val">{timeAgo(lastIngestion)}</span></div>
        </div>

        <div className="footer-actions">
          <button className="footer-btn" onClick={runIngestion} disabled={isRefreshing}
            title="Pull latest data from all sources">
            {isRefreshing ? <span className="spinner-sm" /> : <span aria-hidden>📡</span>}
            <span className="fb-label">Ingest Data</span>
          </button>
          <button className="footer-btn primary" onClick={refresh} disabled={isRefreshing}
            title="Re-run the risk scoring agent">
            {isRefreshing ? <span className="spinner-sm" /> : <span aria-hidden>⟳</span>}
            <span className="fb-label">{isRefreshing ? 'Working…' : 'Refresh Scores'}</span>
          </button>
        </div>

        <button className="sidebar-collapse-btn" onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <span aria-hidden>{sidebarCollapsed ? '»' : '«'}</span>
          <span className="fb-label footer-expanded">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
