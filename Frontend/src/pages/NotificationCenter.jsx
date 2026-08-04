import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Search, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Select, SelectItem } from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import NotificationItem from '../components/notifications/NotificationItem';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/notificationService';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };
const PAGE_SIZE = 15;

const TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'leave_submitted', label: 'Leave Submitted' },
  { value: 'leave_approved', label: 'Leave Approved' },
  { value: 'leave_rejected', label: 'Leave Rejected' },
  { value: 'expense_submitted', label: 'Expense Submitted' },
  { value: 'expense_approved', label: 'Expense Approved' },
  { value: 'expense_rejected', label: 'Expense Rejected' },
  { value: 'payroll_generated', label: 'Payroll Generated' },
  { value: 'employee_created', label: 'Employee Created' },
  { value: 'employee_updated', label: 'Employee Updated' },
  { value: 'department_created', label: 'Department Created' },
  { value: 'team_created', label: 'Team Created' },
  { value: 'vendor_added', label: 'Vendor Added' },
  { value: 'budget_exceeded', label: 'Budget Exceeded' },
  { value: 'budget_updated', label: 'Budget Updated' },
  { value: 'organization_announcement', label: 'Announcements' },
  { value: 'holiday_added', label: 'Holiday Added' },
  { value: 'report_generated', label: 'Report Generated' },
];

/**
 * Notification Center Page
 * ------------------------------------------------------------------
 * Sprint 14. Full history: search, type filter, read/unread filter,
 * pagination (matches Departments.jsx's PAGE_SIZE/page convention
 * rather than infinite scroll), mark read, delete. Uses
 * NotificationItem in its roomier default (non-"dropdown") variant.
 */
export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [readFilter, setReadFilter] = useState(''); // '' | 'true' | 'false'

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error, meta } = await getNotifications({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      type: type || undefined,
      is_read: readFilter || undefined,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Unable to load notifications.', { style: TOAST_STYLE });
      return;
    }
    setNotifications(data);
    setTotal(meta?.total ?? data.length);
  }, [page, search, type, readFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [search, type, readFilter]);

  const hasUnread = useMemo(() => notifications.some((n) => !n.is_read), [notifications]);

  const handleMarkRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    const { error } = await markNotificationAsRead(id);
    if (error) {
      toast.error('Unable to update notification.', { style: TOAST_STYLE });
      refresh();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await markAllNotificationsAsRead();
    if (error) {
      toast.error('Unable to mark all as read.', { style: TOAST_STYLE });
      refresh();
    } else {
      toast.success('All notifications marked as read.', { style: TOAST_STYLE });
    }
  };

  const handleDelete = async (id) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));

    const { error } = await deleteNotification(id);
    if (error) {
      toast.error('Unable to delete notification.', { style: TOAST_STYLE });
      setNotifications(previous);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
            <Bell size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Notification Center</h1>
            <p className="text-sm text-slate-400">Every notification, across every module</p>
          </div>
        </div>

        {hasUnread && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck size={16} className="mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      <Card glass className="p-4 md:p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <Input icon={Search} placeholder="Search notifications..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-full sm:w-56">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPE_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select value={readFilter} onChange={(e) => setReadFilter(e.target.value)}>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="false">Unread</SelectItem>
            <SelectItem value="true">Read</SelectItem>
          </Select>
        </div>
      </Card>

      <Card glass className="p-3 md:p-4">
        {loading ? (
          <div className="animate-pulse space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications found"
            description={search || type || readFilter ? 'Try adjusting your filters.' : "You're all caught up."}
          />
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                variant="center"
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {!loading && notifications.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/5">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} notification{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
