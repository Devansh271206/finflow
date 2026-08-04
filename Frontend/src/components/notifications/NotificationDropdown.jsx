import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import NotificationItem from './NotificationItem';
import EmptyState from '../ui/EmptyState';

/**
 * Notification Dropdown
 * ------------------------------------------------------------------
 * Sprint 14. Bell preview panel — last 5 notifications, mark-all-read,
 * "View all" -> /notifications. Replaces the inline dropdown block
 * previously embedded directly in DashboardLayout.jsx (see
 * NotificationBell.jsx, the next file, for where this gets mounted).
 *
 * Pure presentational — all data/state (notifications, loading,
 * mark-read/delete handlers) is owned by NotificationBell.jsx and
 * passed down, same split NotificationItem.jsx already established.
 */
export default function NotificationDropdown({ notifications, loading, onMarkRead, onMarkAllRead, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-sm font-bold text-white">Notifications</span>
        {notifications.some((n) => !n.is_read) && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#10b981] hover:text-emerald-400 transition-colors"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[360px] overflow-y-auto p-2">
        {loading ? (
          <div className="animate-pulse space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6">
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
          </div>
        ) : (
          notifications
            .slice(0, 5)
            .map((n) => (
              <NotificationItem key={n.id} notification={n} variant="dropdown" onMarkRead={onMarkRead} />
            ))
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onClose && onClose();
          navigate('/notifications');
        }}
        className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white py-3 border-t border-white/5 transition-colors"
      >
        View all notifications
      </button>
    </div>
  );
}
