'use client';

import { useDashboard } from './DashboardProvider';
import Sidebar from './Sidebar';

export default function AppShell({ children }) {
  const { sidebarCollapsed } = useDashboard();
  return (
    <div className={`app-layout ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <Sidebar />
      <div className="app-content">{children}</div>
    </div>
  );
}
