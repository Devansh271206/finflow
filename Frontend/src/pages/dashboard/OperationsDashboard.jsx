import React from 'react';
import { Building2, CheckCircle2, RefreshCw, TrendingDown, Clock, Package } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import KpiGrid from '../../components/dashboard/KpiGrid';
import QuickActions from '../../components/dashboard/QuickActions';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const QUICK_ACTIONS = [
  { label: 'Manage Vendors', path: '/vendors', icon: Building2, variant: 'primary' },
];

/**
 * Sprint 10 — Role-Based Dashboard System.
 * Operations dashboard: Vendor Overview, Active Vendors, Subscription
 * Renewals, Procurement Summary (placeholder), Cost Optimization,
 * Recent Vendor Activity.
 *
 * Receives `data` already fetched once by Dashboard.jsx.
 */
export default function OperationsDashboard({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <KpiGrid items={[]} loading columns={3} />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  const {
    vendorOverview = { totalVendors: 0, activeVendors: 0, subscriptionVendors: 0 },
    subscriptionRenewals = [],
    procurementSummary = { available: false, items: [] },
    costOptimization = [],
    recentVendorActivity = [],
  } = data;

  const kpis = [
    {
      title: 'Total Vendors',
      value: vendorOverview.totalVendors,
      icon: Building2,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Active Vendors',
      value: vendorOverview.activeVendors,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Renewals Due (30d)',
      value: subscriptionRenewals.length,
      icon: RefreshCw,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
    },
  ];

  const topSpend = costOptimization[0]?.total || 0;

  return (
    <div className="space-y-6">
      <KpiGrid items={kpis} columns={3} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Renewals */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Subscription Renewals</h3>
          {subscriptionRenewals.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nothing due soon"
              description="Vendor subscriptions renewing in the next 30 days will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {subscriptionRenewals.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{v.name}</p>
                    <p className="text-xs text-slate-500">{v.billing_cycle || 'Subscription'}</p>
                  </div>
                  <Badge variant="warning">{formatDate(v.next_billing_date)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cost Optimization */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Cost Optimization</h3>
          <p className="text-xs text-slate-500 mb-3">Top vendors by spend — highest-concentration risk first.</p>
          {costOptimization.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="No vendor spend yet"
              description="Vendor spend concentration will show up here once expenses are linked to vendors."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {costOptimization.map((v) => (
                <div key={v.vendorId} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <p className="text-sm font-medium text-white">{v.vendorName}</p>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-300">
                      {Number(v.total || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                    </p>
                    {topSpend > 0 && (
                      <p className="text-xs text-slate-500">{Math.round((v.total / topSpend) * 100)}% of top vendor</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Procurement Summary (placeholder) */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Procurement Summary</h3>
          <EmptyState
            icon={Package}
            title="Coming soon"
            description={
              procurementSummary.available
                ? 'No procurement activity yet.'
                : 'A dedicated procurement module hasn\'t been built yet — this will populate in a future sprint.'
            }
            className="border-none bg-transparent p-4"
          />
        </Card>

        {/* Recent Vendor Activity */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Recent Vendor Activity</h3>
          {recentVendorActivity.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No recent activity"
              description="Recently added or updated vendors will show up here."
              className="border-none bg-transparent p-4"
            />
          ) : (
            <div>
              {recentVendorActivity.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <p className="text-sm font-medium text-white">{v.name}</p>
                  <Badge variant={v.is_active ? 'success' : 'default'}>
                    {v.is_active ? 'Active' : 'Inactive'}
                  </Badge>
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
