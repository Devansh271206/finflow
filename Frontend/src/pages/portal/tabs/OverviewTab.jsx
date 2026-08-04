import React from 'react';
import {
  UserCircle,
  Building2,
  Users,
  Briefcase,
  CalendarDays,
  Wallet,
  Bell,
  ArrowRight,
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import StatCard from '../../../components/ui/StatCard';
import EmptyState from '../../../components/ui/EmptyState';

const STATUS_BADGE_VARIANT = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'danger',
};

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatMonthYear(month, year) {
  if (!month || !year) return '—';
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/**
 * Overview tab — welcome card + profile/employment summary + quick
 * stats. Purely a presentation layer over the payload the portal
 * shell already fetched from GET /api/ess/overview; this component
 * makes no requests of its own.
 */
export function OverviewTab({ overview, onNavigateTab }) {
  const employee = overview?.employee;
  const employment = overview?.employment;
  const leave = overview?.leave;
  const payroll = overview?.payroll;
  const notifications = overview?.notifications;

  if (!employee) {
    return (
      <EmptyState
        icon={UserCircle}
        title="No overview data available"
        description="We couldn't load your profile summary. Try refreshing the page."
      />
    );
  }

  const firstName = employee.full_name?.split(' ')[0] || 'there';
  const totalRemaining = Array.isArray(leave?.balances)
    ? leave.balances.reduce((sum, b) => {
        const remaining =
          Number(b.allocated_days || 0) +
          Number(b.carried_forward_days || 0) -
          Number(b.used_days || 0);
        return sum + remaining;
      }, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Welcome back,</p>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mt-0.5">
              {firstName} 👋
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              {employee.designation || 'No designation set'}
              {employee.department ? ` · ${employee.department}` : ''}
            </p>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[employment?.employmentStatus] || 'default'}>
            {(employment?.employmentStatus || 'unknown').replace('_', ' ')}
          </Badge>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Leave Balance"
          value={`${totalRemaining} days`}
          icon={CalendarDays}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
          subtext={
            leave?.pendingRequestsCount
              ? `${leave.pendingRequestsCount} pending request${leave.pendingRequestsCount > 1 ? 's' : ''}`
              : 'No pending requests'
          }
        />
        <StatCard
          title="Latest Payslip"
          value={
            payroll?.latestPayslip
              ? formatMonthYear(payroll.latestPayslip.pay_period_month, payroll.latestPayslip.pay_period_year)
              : '—'
          }
          icon={Wallet}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-400"
          subtext={`${payroll?.recordCount || 0} record${(payroll?.recordCount || 0) === 1 ? '' : 's'} total`}
        />
        <StatCard
          title="Notifications"
          value={notifications?.unreadCount ?? 0}
          icon={Bell}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-400"
          subtext="unread"
        />
      </div>

      {/* Employee Information */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <UserCircle size={16} className="text-slate-500" />
          Employee Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <InfoRow icon={Briefcase} label="Employee ID" value={employee.employee_code} />
          <InfoRow icon={Briefcase} label="Designation" value={employee.designation} />
          <InfoRow icon={Building2} label="Department" value={employee.department} />
          <InfoRow icon={Users} label="Manager" value={employee.reporting_manager_name} />
          <InfoRow icon={CalendarDays} label="Joining Date" value={formatDate(employee.date_of_joining)} />
          <InfoRow
            icon={Briefcase}
            label="Employment Type"
            value={(employee.employment_type || '—').replace('_', ' ')}
          />
        </div>
      </Card>

      {/* Quick links to the other tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLinkCard
          title="Apply for Leave"
          description="Submit a new leave request"
          icon={CalendarDays}
          onClick={() => onNavigateTab?.('leave')}
        />
        <QuickLinkCard
          title="View Payslips"
          description="See your payroll history"
          icon={Wallet}
          onClick={() => onNavigateTab?.('payroll')}
        />
        <QuickLinkCard
          title="My Documents"
          description="Offer letter, tax docs & more"
          icon={Briefcase}
          onClick={() => onNavigateTab?.('documents')}
        />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/5 text-slate-500">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-white">{value || '—'}</p>
      </div>
    </div>
  );
}

function QuickLinkCard({ title, description, icon: Icon, onClick }) {
  return (
    <Card onClick={onClick} className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <ArrowRight size={16} className="text-slate-600" />
    </Card>
  );
}

export default OverviewTab;
