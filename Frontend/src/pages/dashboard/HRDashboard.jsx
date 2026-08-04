import React from 'react';
import { Users, UserCheck, CalendarDays, PlaneTakeoff, Gift, PartyPopper, UserPlus } from 'lucide-react';
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
  { label: 'Add Employee', path: '/employees/new', icon: UserPlus, variant: 'primary' },
  { label: 'Approve Leave', path: '/leave-approvals', icon: CalendarDays },
  { label: 'All Employees', path: '/employees', icon: Users },
  { label: 'Departments', path: '/departments', icon: UserCheck },
];

/**
 * Sprint 10 — Role-Based Dashboard System.
 * HR dashboard: Employee Count, Active Employees, Leave Requests,
 * Employees On Leave Today, Upcoming Birthdays (placeholder),
 * Upcoming Work Anniversaries, Recent Joinees, Quick Actions.
 *
 * Receives `data` already fetched once by Dashboard.jsx.
 */
export default function HRDashboard({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <KpiGrid items={[]} loading columns={4} />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  const {
    employeeCount = { total: 0, active: 0 },
    leaveRequests = { pendingCount: 0, recent: [] },
    employeesOnLeaveToday = [],
    upcomingBirthdays = { available: false, items: [] },
    upcomingAnniversaries = [],
    recentJoinees = [],
  } = data;

  const kpis = [
    {
      title: 'Total Employees',
      value: employeeCount.total,
      icon: Users,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Active Employees',
      value: employeeCount.active,
      icon: UserCheck,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Pending Leave Requests',
      value: leaveRequests.pendingCount,
      icon: CalendarDays,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
    },
    {
      title: 'On Leave Today',
      value: employeesOnLeaveToday.length,
      icon: PlaneTakeoff,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-400',
    },
  ];

  return (
    <div className="space-y-6">
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Requests */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Leave Requests</h3>
          {leaveRequests.recent.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing pending"
              description="Leave requests awaiting approval across the org will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {leaveRequests.recent.map((r) => (
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

        {/* Employees On Leave Today */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Employees On Leave Today</h3>
          {employeesOnLeaveToday.length === 0 ? (
            <EmptyState
              icon={PlaneTakeoff}
              title="Everyone's in"
              description="No one is on approved leave today."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {employeesOnLeaveToday.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <p className="text-sm font-medium text-white">{r.employee?.full_name || 'Employee'}</p>
                  <p className="text-xs text-slate-500">Back {formatDate(r.end_date)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Work Anniversaries */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Upcoming Work Anniversaries</h3>
          {upcomingAnniversaries.length === 0 ? (
            <EmptyState
              icon={PartyPopper}
              title="None this month"
              description="Work anniversaries in the next 30 days will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {upcomingAnniversaries.map((a) => (
                <div key={a.employeeId} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <p className="text-sm font-medium text-white">{a.fullName}</p>
                  <span className="text-xs text-slate-500">
                    {a.yearsOfService} yr{a.yearsOfService === 1 ? '' : 's'} · {formatDate(a.anniversaryDate)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Birthdays (placeholder) */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Upcoming Birthdays</h3>
          <EmptyState
            icon={Gift}
            title="Coming soon"
            description={
              upcomingBirthdays.available
                ? 'No birthdays in the next 30 days.'
                : 'Birthdays will appear here once date of birth is added to employee profiles.'
            }
            className="border-none bg-transparent p-4"
          />
        </Card>

        {/* Recent Joinees */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Recent Joinees</h3>
          {recentJoinees.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No recent joinees"
              description="Newly onboarded employees will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {recentJoinees.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{e.full_name}</p>
                    <p className="text-xs text-slate-500">{e.designation || '—'}</p>
                  </div>
                  <span className="text-xs text-slate-500">{formatDate(e.date_of_joining)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
