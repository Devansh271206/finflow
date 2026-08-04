import React, { useEffect, useState } from 'react';
import { Bell, CalendarDays, Wallet, Receipt, Megaphone, CheckCheck } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Skeleton from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import NotificationItem from '../../../components/notifications/NotificationItem';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../../services/notificationService';

/**
 * Sprint 14: realigned from the old free-text type guessing
 * ('leave'/'payroll'/'expense'/fallback) to bucket by prefix against
 * the real 17-value typed set eventTypes.js defines server-side (plus
 * the same legacy values migration 019 kept valid for backward
 * compatibility). Row rendering now delegates to the shared
 * NotificationItem component (variant="center") instead of this file
 * duplicating its own row markup — the icon/color-per-type mapping
 * that used to live here now lives in exactly one place.
 *
 * ESS Portal users are typically Employees, so in practice they'll
 * mostly see Leave/Expense/Payroll/Holiday/Announcement notifications
 * (Employee/Department/Team/Vendor/Budget/Report events are recipient-
 * scoped to Admin/HR server-side, per notificationRecipientHelpers.js)
 * — but bucketing is written generically so nothing silently
 * disappears if an Employee's role ever changes.
 */
function bucketFor(type) {
  if (type === 'leave' || type.startsWith('leave_')) return 'Leave Updates';
  if (type === 'payroll' || type.startsWith('payroll_')) return 'Payroll Notifications';
  if (type === 'expense' || type.startsWith('expense_')) return 'Expense Updates';
  if (type === 'holiday_added') return 'Holiday Updates';
  return 'Organization Announcements';
}

const BUCKET_ICON = {
  'Leave Updates': CalendarDays,
  'Payroll Notifications': Wallet,
  'Expense Updates': Receipt,
  'Holiday Updates': CalendarDays,
  'Organization Announcements': Megaphone,
};

const BUCKET_ORDER = [
  'Leave Updates',
  'Payroll Notifications',
  'Expense Updates',
  'Holiday Updates',
  'Organization Announcements',
];

/**
 * Notifications tab — full list (not just the Overview preview),
 * grouped by module. Built entirely on notificationService.js.
 */
export function NotificationsTab() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    // limit=100: the portal tab shows recent history in one scroll,
    // not the paginated Notification Center page — a generous single
    // page rather than adding pagination controls to this tab too.
    const { data } = await getNotifications({ limit: 100 });
    setNotifications(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await markNotificationAsRead(id);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    await markAllNotificationsAsRead();
    setMarkingAll(false);
    loadNotifications();
  }

  if (loading) {
    return <Skeleton variant="rect" className="h-64" />;
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const grouped = notifications.reduce((acc, n) => {
    const bucket = bucketFor(n.type);
    if (!acc[bucket]) acc[bucket] = [];
    acc[bucket].push(n);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell size={16} className="text-slate-500" />
            Notifications
          </h3>
          {unreadCount > 0 && <p className="text-xs text-slate-500 mt-1">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="secondary" onClick={handleMarkAllRead} loading={markingAll} disabled={markingAll}>
            <CheckCheck size={14} className="mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="New notifications about your leave, payroll, and expenses will show up here."
          />
        </Card>
      ) : (
        BUCKET_ORDER.filter((bucket) => grouped[bucket]?.length).map((bucket) => {
          const Icon = BUCKET_ICON[bucket];
          return (
            <Card key={bucket}>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon size={14} />
                {bucket}
              </h4>
              <div className="space-y-1">
                {grouped[bucket].map((n) => (
                  <NotificationItem key={n.id} notification={n} variant="center" onMarkRead={handleMarkRead} />
                ))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

export default NotificationsTab;
