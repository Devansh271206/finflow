import React from 'react';
import { Receipt, CalendarDays } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';

const LEAVE_STATUS_VARIANT = {
  pending: 'warning',
  dept_approved: 'info',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function ActivityRow({ item }) {
  if (item.type === 'transaction') {
    return (
      <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5 text-slate-400">
            <Receipt size={16} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{item.title || 'Transaction'}</p>
            <p className="text-xs text-slate-500">{formatDate(item.date)}</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-slate-300">
          {Number(item.amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
        </span>
      </div>
    );
  }

  // leave_request
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5 text-slate-400">
          <CalendarDays size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Leave request</p>
          <p className="text-xs text-slate-500">{formatDate(item.date)}</p>
        </div>
      </div>
      <Badge variant={LEAVE_STATUS_VARIANT[item.status] || 'default'}>
        {(item.status || '').replace('_', ' ')}
      </Badge>
    </div>
  );
}

/**
 * Sprint 10 — Role-Based Dashboard System.
 *
 * Renders the `recentActivity` array roleDashboardService.js's
 * buildRecentActivity() produces on the Executive dashboard — a small
 * interleaved feed of recent expense transactions and leave request
 * status changes, newest first. Generic enough to reuse for any other
 * dashboard that adopts the same { type, id, title/status, amount?,
 * date } shape later, without needing a second component.
 */
export default function RecentActivity({ items = [], loading = false, title = 'Recent Activity' }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-300 mb-2">{title}</h3>
      {loading ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : !items.length ? (
        <EmptyState
          title="No recent activity"
          description="Recent transactions and leave requests will show up here as they happen."
          className="border-none bg-transparent p-4"
        />
      ) : (
        <div>
          {items.map((item) => (
            <ActivityRow key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}
