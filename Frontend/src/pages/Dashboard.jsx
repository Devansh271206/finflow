import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { getRoleDashboard } from '../services/roleDashboardService';
import ExecutiveDashboard from './dashboard/ExecutiveDashboard';
import FinanceDashboard from './dashboard/FinanceDashboard';
import HRDashboard from './dashboard/HRDashboard';
import OperationsDashboard from './dashboard/OperationsDashboard';
import DepartmentLeadDashboard from './dashboard/DepartmentLeadDashboard';
import EmployeeDashboard from './dashboard/EmployeeDashboard';

/**
 * Sprint 10 — Role-Based Dashboard System.
 *
 * This page is now a thin role ROUTER, not a dashboard implementation
 * itself: it fetches GET /api/dashboard/role-summary exactly once,
 * reads `role` back from that same response (roleDashboardController.js
 * resolved it server-side via dashboardRoleMap.js — this component
 * deliberately does not re-derive a role from permissions itself, so
 * there is exactly one role→dashboard mapping in the whole system, not
 * two that could drift apart), and renders the matching page component
 * from ./dashboard/*, passing the rest of the payload through as props.
 *
 * The previous personal-finance dashboard that used to live in this
 * file (recharts widgets over getDashboardData/getBudgets/getGoals/
 * getBills) is intentionally retired here per the sprint goal —
 * "Replace the existing generic dashboard with a fully role-aware
 * dashboard system." Its backing endpoint, GET /api/dashboard
 * (dashboardController.js/dashboardService.js), is untouched and still
 * live for backward compatibility; it's simply no longer rendered by
 * this page.
 */

const ROLE_COMPONENTS = {
  executive: ExecutiveDashboard,
  finance: FinanceDashboard,
  hr: HRDashboard,
  operations: OperationsDashboard,
  dept_lead: DepartmentLeadDashboard,
  employee: EmployeeDashboard,
};

const ROLE_LABELS = {
  executive: 'Executive Overview',
  finance: 'Finance Overview',
  hr: 'HR Overview',
  operations: 'Operations Overview',
  dept_lead: 'Department Overview',
  employee: 'My Dashboard',
};

export default function Dashboard() {
  const { user } = useApp();
  const [role, setRole] = useState(null);
  const [widgetData, setWidgetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getRoleDashboard();

    if (fetchError) {
      setError(fetchError.message || 'Failed to load dashboard');
      setLoading(false);
      return;
    }

    const { role: resolvedRole, ...rest } = data || {};
    setRole(resolvedRole);
    setWidgetData(rest);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard</h1>
        <EmptyState
          title="Couldn't load your dashboard"
          description={error}
          actionText="Try again"
          onAction={fetchDashboard}
          icon={AlertTriangle}
        />
      </div>
    );
  }

  const RoleDashboard = ROLE_COMPONENTS[role] || EmployeeDashboard;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {loading ? 'Dashboard' : ROLE_LABELS[role] || 'Dashboard'}
        </h1>
        {!loading && user?.name && (
          <p className="text-sm text-slate-500 mt-1">Welcome back, {user.name.split(' ')[0]}.</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4 rounded-[18px] bg-[#111827] border border-white/5 p-5">
          <Skeleton variant="rect" className="h-24 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton variant="rect" className="h-32" />
            <Skeleton variant="rect" className="h-32" />
          </div>
        </div>
      ) : !role ? (
        <EmptyState
          title="No dashboard view available"
          description="Your workspace role is not mapped to a dashboard view yet."
        />
      ) : (
        <RoleDashboard data={widgetData} loading={loading} />
      )}
    </div>
  );
}
