import React from 'react';
import { Users, CalendarDays, Wallet, Briefcase } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import KpiGrid from '../../components/dashboard/KpiGrid';
import QuickActions from '../../components/dashboard/QuickActions';

const LEAVE_STATUS_VARIANT = {
  pending: 'warning',
  dept_approved: 'info',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const QUICK_ACTIONS = [
  { label: 'Approve Leave', path: '/leave-approvals', icon: CalendarDays, variant: 'primary' },
  { label: 'My Team', path: '/team', icon: Users },
  { label: 'Department Employees', path: '/employees', icon: Briefcase },
  { label: 'Budgets', path: '/budgets', icon: Wallet },
];

/**
 * Sprint 10 — Role-Based Dashboard System.
 * Department Lead dashboard: Department Employees, Team Overview,
 * Pending Leave Requests, Pending Expense Requests, Department Budget
 * Summary, Quick Actions.
 *
 * Receives `data` already fetched once by Dashboard.jsx.
 */
export default function DepartmentLeadDashboard({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <KpiGrid items={[]} loading columns={4} />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  const {
    departmentAssigned,
    department,
    departmentEmployees = { total: 0, items: [] },
    teamOverview = [],
    pendingLeaveRequests = { count: 0, recent: [] },
    pendingExpenseRequests = { count: 0, recent: [] },
    departmentBudget = { totalLimit: 0, totalSpent: 0, remaining: 0, utilization: 0 },
  } = data;

  if (!departmentAssigned) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Briefcase}
          title="No department assigned yet"
          description="Your account isn't assigned to a department yet. Ask an admin to assign you to one to see your team's dashboard here."
        />
        <QuickActions actions={QUICK_ACTIONS} />
      </div>
    );
  }

  const kpis = [
    {
      title: 'Department Employees',
      value: departmentEmployees.total,
      icon: Users,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Teams',
      value: teamOverview.length,
      icon: Briefcase,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-400',
    },
    {
      title: 'Pending Leave Requests',
      value: pendingLeaveRequests.count,
      icon: CalendarDays,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
    },
    {
      title: 'Budget Utilization',
      value: `${departmentBudget.utilization}%`,
      icon: Wallet,
      subtext: `${departmentBudget.remaining.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} remaining`,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-white">{department?.name || 'Your Department'}</h2>
        <p className="text-sm text-slate-400 mt-1">Department overview and pending approvals.</p>
      </Card>

      <KpiGrid items={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Overview */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Team Overview</h3>
          {teamOverview.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No teams yet"
              description="Teams in your department will appear here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {teamOverview.map((team) => (
                <div key={team.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{team.name}</p>
                    <p className="text-xs text-slate-500">Lead: {team.lead?.full_name || 'Unassigned'}</p>
                  </div>
                  <Badge variant={team.is_active ? 'success' : 'default'}>
                    {team.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending Leave Requests */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Pending Leave Requests</h3>
          {pendingLeaveRequests.recent.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing pending"
              description="Leave requests awaiting your approval will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {pendingLeaveRequests.recent.map((r) => (
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
      </div>

      {/* Pending Expense Requests */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Pending Expense Requests</h3>
        {pendingExpenseRequests.recent.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nothing pending"
            description="Expense requests from your department awaiting approval will show up here."
            className="border-none bg-transparent p-4"
          />
        ) : (
          <div>
            {pendingExpenseRequests.recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{t.title || t.merchant || 'Expense'}</p>
                  <p className="text-xs text-slate-500">{formatDate(t.transaction_date)}</p>
                </div>
                <span className="text-sm font-semibold text-slate-300">
                  {Number(t.amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
