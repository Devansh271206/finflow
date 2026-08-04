import React from 'react';
import { CalendarDays, Wallet, FileText, Megaphone, PartyPopper, Plus, User } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import KpiGrid from '../../components/dashboard/KpiGrid';
import QuickActions from '../../components/dashboard/QuickActions';
import { useApp } from '../../context/AppContext';

const LEAVE_STATUS_VARIANT = {
  pending: 'warning',
  dept_approved: 'info',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const QUICK_ACTIONS = [
  { label: 'Apply for Leave', path: '/leave-requests', icon: Plus, variant: 'primary' },
  { label: 'Submit Expense', path: '/transactions', icon: Wallet },
  { label: 'View Payslips', path: '/payroll', icon: FileText },
  { label: 'My Profile', path: '/profile', icon: User },
];

/**
 * Sprint 10 — Role-Based Dashboard System.
 * Employee dashboard: Welcome Card, My Profile, Leave Balance, My Leave
 * Requests, My Expense Requests, My Payslips, Company Announcements
 * (placeholder), Upcoming Holidays (placeholder), Quick Actions.
 *
 * Receives `data` already fetched once by Dashboard.jsx (the role
 * router) — this component does no fetching of its own.
 */
export default function EmployeeDashboard({ data, loading }) {
  const { user } = useApp();

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rect" className="h-24" />
        <KpiGrid items={[]} loading columns={4} />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  const {
    hasEmployeeRecord,
    profile,
    leaveBalance = [],
    myLeaveRequests = [],
    myExpenseRequests = [],
    myPayslips = [],
  } = data;

  const firstName = (profile?.full_name || user?.name || 'there').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-br from-[#10b981]/10 to-transparent">
        <h2 className="text-xl font-bold text-white">Welcome back, {firstName} 👋</h2>
        <p className="text-sm text-slate-400 mt-1">
          {profile?.designation ? `${profile.designation} · ` : ''}
          Here's what's happening with your account today.
        </p>
      </Card>

      {!hasEmployeeRecord ? (
        <EmptyState
          icon={User}
          title="No employee profile linked yet"
          description="Your account isn't linked to an employee record in this workspace yet. Ask an admin to link it to see your leave balance, payslips, and expense requests here."
        />
      ) : (
        <>
          {/* My Profile */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-300 mb-4">My Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Full Name</p>
                <p className="text-white font-medium">{profile?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Employee Code</p>
                <p className="text-white font-medium">{profile?.employee_code || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Designation</p>
                <p className="text-white font-medium">{profile?.designation || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Email</p>
                <p className="text-white font-medium">{profile?.email || '—'}</p>
              </div>
            </div>
          </Card>

          {/* Leave Balance */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Leave Balance</h3>
            {leaveBalance.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No leave balance yet"
                description="Your leave balances will appear here once they're allocated."
              />
            ) : (
              <KpiGrid
                columns={leaveBalance.length >= 3 ? 3 : leaveBalance.length}
                items={leaveBalance.map((b) => ({
                  title: b.leave_type?.name || 'Leave',
                  value: `${b.remaining_days ?? 0} days`,
                  icon: CalendarDays,
                  subtext: `of ${b.allocated_days ?? 0} allocated`,
                  iconBg: 'bg-emerald-500/10',
                  iconColor: 'text-emerald-400',
                }))}
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* My Leave Requests */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">My Leave Requests</h3>
              {myLeaveRequests.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No leave requests yet"
                  description="Requests you submit will show up here."
                  className="border-none bg-transparent p-4"
                />
              ) : (
                <div>
                  {myLeaveRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-white">{r.leave_type?.name || 'Leave'}</p>
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

            {/* My Expense Requests */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">My Expense Requests</h3>
              {myExpenseRequests.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No expense requests yet"
                  description="Expenses you submit will show up here."
                  className="border-none bg-transparent p-4"
                />
              ) : (
                <div>
                  {myExpenseRequests.map((t) => (
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
          </div>

          {/* My Payslips */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">My Payslips</h3>
            {myPayslips.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No payslips yet"
                description="Payslips will appear here once payroll records are recorded for you."
                className="border-none bg-transparent p-4"
              />
            ) : (
              <div>
                {myPayslips.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <p className="text-sm font-medium text-white">
                      {p.pay_period_month}/{p.pay_period_year}
                    </p>
                    <span className="text-sm font-semibold text-slate-300">
                      {Number(p.net_salary || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Announcements (placeholder) */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Company Announcements</h3>
              <EmptyState
                icon={Megaphone}
                title="Coming soon"
                description="Company-wide announcements will appear here in a future update."
                className="border-none bg-transparent p-4"
              />
            </Card>

            {/* Upcoming Holidays (placeholder) */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Upcoming Holidays</h3>
              <EmptyState
                icon={PartyPopper}
                title="Coming soon"
                description="The holiday calendar will appear here in a future update."
                className="border-none bg-transparent p-4"
              />
            </Card>
          </div>
        </>
      )}

      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
