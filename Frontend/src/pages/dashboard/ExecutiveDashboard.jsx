import React from 'react';
import { Users, Building2, UsersRound, UserCheck, Receipt, TrendingUp, Landmark, ClipboardCheck, CalendarDays, Truck, FileBarChart } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import KpiGrid from '../../components/dashboard/KpiGrid';
import QuickActions from '../../components/dashboard/QuickActions';
import RecentActivity from '../../components/dashboard/RecentActivity';

const LEAVE_STATUS_VARIANT = {
  pending: 'warning',
  dept_approved: 'info',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
};

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const QUICK_ACTIONS = [
  { label: 'Reports', path: '/reports', icon: FileBarChart, variant: 'primary' },
  { label: 'Employees', path: '/employees', icon: Users },
  { label: 'Departments', path: '/departments', icon: Building2 },
  { label: 'Budgets', path: '/budgets', icon: TrendingUp },
];

/**
 * Sprint 10 — Role-Based Dashboard System.
 * Executive dashboard: Organization Overview, Total Employees,
 * Department Count, Team Count, Active Employees, Monthly Expenses,
 * Budget Utilization, Payroll Summary, Pending Approvals, Leave
 * Summary, Vendor Summary, Recent Activity, Quick Actions.
 *
 * Receives `data` already fetched once by Dashboard.jsx.
 */
export default function ExecutiveDashboard({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <KpiGrid items={[]} loading columns={4} />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  const {
    organizationOverview = { totalEmployees: 0, activeEmployees: 0, departmentCount: 0, teamCount: 0 },
    budgetUtilization = { totalLimit: 0, totalSpent: 0, remaining: 0, utilization: 0 },
    monthlyExpenses = { total: 0, transactionCount: 0 },
    payrollSummary = { totalNet: 0, recordCount: 0 },
    pendingApprovals = { count: 0, recent: [] },
    leaveSummary = { pendingCount: 0, recent: [] },
    vendorSummary = { totalVendors: 0, activeVendors: 0, renewalRisks: [] },
    recentActivity = [],
  } = data;

  const overviewKpis = [
    {
      title: 'Total Employees',
      value: organizationOverview.totalEmployees,
      icon: Users,
      subtext: `${organizationOverview.activeEmployees} active`,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Departments',
      value: organizationOverview.departmentCount,
      icon: Building2,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-400',
    },
    {
      title: 'Teams',
      value: organizationOverview.teamCount,
      icon: UsersRound,
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-400',
    },
    {
      title: 'Active Employees',
      value: organizationOverview.activeEmployees,
      icon: UserCheck,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
  ];

  const financeKpis = [
    {
      title: 'Monthly Expenses',
      value: formatCurrency(monthlyExpenses.total),
      icon: Receipt,
      subtext: `${monthlyExpenses.transactionCount} transactions`,
      iconBg: 'bg-rose-500/10',
      iconColor: 'text-rose-400',
    },
    {
      title: 'Budget Utilization',
      value: `${budgetUtilization.utilization}%`,
      icon: TrendingUp,
      subtext: `${formatCurrency(budgetUtilization.remaining)} remaining`,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Payroll (Net)',
      value: formatCurrency(payrollSummary.totalNet),
      icon: Landmark,
      subtext: `${payrollSummary.recordCount} records`,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Pending Approvals',
      value: pendingApprovals.count,
      icon: ClipboardCheck,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Organization Overview</h3>
        <KpiGrid items={overviewKpis} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Financial Overview</h3>
        <KpiGrid items={financeKpis} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Summary */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Leave Summary</h3>
          {leaveSummary.recent.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing pending"
              description="Leave requests awaiting approval across the org will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {leaveSummary.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{r.employee?.full_name || 'Employee'}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(r.start_date)}
                      {r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                    </p>
                  </div>
                  <Badge variant={LEAVE_STATUS_VARIANT[r.status] || 'default'}>
                    {(r.status || '').replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Vendor Summary */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Vendor Summary</h3>
          <div className="flex items-center gap-6 mb-3">
            <div>
              <p className="text-2xl font-bold text-white">{vendorSummary.totalVendors}</p>
              <p className="text-xs text-slate-500">Total Vendors</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{vendorSummary.activeVendors}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{vendorSummary.renewalRisks.length}</p>
              <p className="text-xs text-slate-500">Renewals Due</p>
            </div>
          </div>
          {vendorSummary.renewalRisks.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No renewals due"
              description="Vendor subscriptions renewing soon will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {vendorSummary.renewalRisks.slice(0, 3).map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <p className="text-sm text-white">{v.name}</p>
                  <span className="text-xs text-slate-500">{formatDate(v.next_billing_date)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <RecentActivity items={recentActivity} />

      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
