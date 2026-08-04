import React from 'react';
import { Wallet, Receipt, ClipboardCheck, Building2, Landmark, TrendingUp, Plus } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import KpiGrid from '../../components/dashboard/KpiGrid';
import QuickActions from '../../components/dashboard/QuickActions';

const APPROVAL_STATUS_VARIANT = {
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  draft: 'default',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

const QUICK_ACTIONS = [
  { label: 'New Transaction', path: '/transactions', icon: Plus, variant: 'primary' },
  { label: 'Budgets', path: '/budgets', icon: Wallet },
  { label: 'Vendors', path: '/vendors', icon: Building2 },
  { label: 'Payroll', path: '/payroll', icon: Landmark },
];

/**
 * Sprint 10 — Role-Based Dashboard System.
 * Finance dashboard: Budget Utilization, Monthly Expenses,
 * Transactions, Pending Expense Approvals, Vendor Payments, Payroll
 * Summary, Recent Transactions, Financial KPIs, Quick Actions.
 *
 * Receives `data` already fetched once by Dashboard.jsx.
 */
export default function FinanceDashboard({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <KpiGrid items={[]} loading columns={4} />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  const {
    budgetUtilization = { totalLimit: 0, totalSpent: 0, remaining: 0, utilization: 0 },
    monthlyExpenses = { total: 0, transactionCount: 0 },
    recentTransactions = [],
    pendingExpenseApprovals = { count: 0, recent: [] },
    vendorPayments = [],
    payrollSummary = { totalNet: 0, recordCount: 0 },
  } = data;

  const kpis = [
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
      title: 'Pending Approvals',
      value: pendingExpenseApprovals.count,
      icon: ClipboardCheck,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
    },
    {
      title: 'Payroll (Net)',
      value: formatCurrency(payrollSummary.totalNet),
      icon: Landmark,
      subtext: `${payrollSummary.recordCount} records`,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <div className="space-y-6">
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Expense Approvals */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Pending Expense Approvals</h3>
          {pendingExpenseApprovals.recent.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nothing pending"
              description="Expenses awaiting approval across the org will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {pendingExpenseApprovals.recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{t.title || t.merchant || 'Expense'}</p>
                    <p className="text-xs text-slate-500">{formatDate(t.transaction_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-300">{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Vendor Payments */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Vendor Payments</h3>
          {vendorPayments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No vendor spend yet"
              description="Top vendor payments will show up here once expenses are linked to vendors."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {vendorPayments.map((v) => (
                <div key={v.vendorId} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <p className="text-sm font-medium text-white">{v.vendorName}</p>
                  <span className="text-sm font-semibold text-slate-300">{formatCurrency(v.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Recent Transactions</h3>
        {recentTransactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Transactions across the workspace will show up here."
            className="border-none bg-transparent p-4"
          />
        ) : (
          <div>
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{t.title || t.merchant || 'Transaction'}</p>
                    <p className="text-xs text-slate-500">{formatDate(t.transaction_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={APPROVAL_STATUS_VARIANT[t.approval_status] || 'default'}>
                    {t.approval_status || 'draft'}
                  </Badge>
                  <span className="text-sm font-semibold text-slate-300 w-20 text-right">
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
