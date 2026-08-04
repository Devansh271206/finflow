import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Receipt, Wallet, UserPlus, UserCog, Building2, Users2,
  Truck, AlertTriangle, Megaphone, CalendarDays, FileBarChart, Bell, Trash2,
} from 'lucide-react';

/**
 * Notification Item
 * ------------------------------------------------------------------
 * Sprint 14. Shared row renderer used by both NotificationDropdown.jsx
 * (bell preview, compact) and NotificationCenter.jsx (full page,
 * roomier) — one component, one place to keep the type->icon mapping
 * and relative-time formatting in sync, per `variant` prop.
 *
 * Consumes the notification shape notificationRepository.js's
 * SELECT_COLUMNS returns: { id, title, message, type, is_read,
 * resource_type, resource_id, action_url, created_at }.
 */

const TYPE_ICON = {
  leave_submitted: Calendar,
  leave_approved: Calendar,
  leave_rejected: Calendar,
  expense_submitted: Receipt,
  expense_approved: Receipt,
  expense_rejected: Receipt,
  payroll_generated: Wallet,
  employee_created: UserPlus,
  employee_updated: UserCog,
  department_created: Building2,
  team_created: Users2,
  vendor_added: Truck,
  budget_exceeded: AlertTriangle,
  budget_updated: Wallet,
  organization_announcement: Megaphone,
  holiday_added: CalendarDays,
  report_generated: FileBarChart,
  // Legacy free-text types (see migration 019's backward-compat note)
  leave: Calendar,
  payroll: Wallet,
  expense: Receipt,
  info: Bell,
};

const TYPE_COLOR = {
  leave_submitted: '#f59e0b',
  leave_approved: '#10b981',
  leave_rejected: '#ef4444',
  expense_submitted: '#f59e0b',
  expense_approved: '#10b981',
  expense_rejected: '#ef4444',
  payroll_generated: '#3b82f6',
  employee_created: '#10b981',
  employee_updated: '#3b82f6',
  department_created: '#3b82f6',
  team_created: '#3b82f6',
  vendor_added: '#3b82f6',
  budget_exceeded: '#ef4444',
  budget_updated: '#f59e0b',
  organization_announcement: '#a855f7',
  holiday_added: '#ef4444',
  report_generated: '#3b82f6',
};

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationItem({ notification, variant = 'dropdown', onMarkRead, onDelete }) {
  const navigate = useNavigate();
  const Icon = TYPE_ICON[notification.type] || Bell;
  const color = TYPE_COLOR[notification.type] || '#6b7280';
  const compact = variant === 'dropdown';

  const handleClick = () => {
    if (!notification.is_read && onMarkRead) onMarkRead(notification.id);
    if (notification.action_url) navigate(notification.action_url);
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 rounded-xl transition-colors cursor-pointer group ${
        compact ? 'p-2.5' : 'p-3.5'
      } ${notification.is_read ? 'hover:bg-white/[0.03]' : 'bg-white/[0.03] hover:bg-white/[0.05]'}`}
    >
      <div
        className={`shrink-0 rounded-lg flex items-center justify-center ${compact ? 'w-8 h-8' : 'w-9 h-9'}`}
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon size={compact ? 14 : 16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-medium text-white leading-snug ${compact ? 'text-xs' : 'text-sm'}`}>
            {notification.title}
          </p>
          {!notification.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0 mt-1.5" />}
        </div>
        {notification.message && (
          <p className={`text-slate-500 truncate mt-0.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {notification.message}
          </p>
        )}
        <p className={`text-slate-600 mt-1 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {timeAgo(notification.created_at)}
        </p>
      </div>

      {!compact && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="shrink-0 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
          aria-label="Delete notification"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
