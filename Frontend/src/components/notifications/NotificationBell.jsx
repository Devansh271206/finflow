import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationDropdown from './NotificationDropdown';
import { getNotifications, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/notificationService';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };
const POLL_INTERVAL_MS = 60000;

/**
 * Notification Bell
 * ------------------------------------------------------------------
 * Sprint 14. Extracted from DashboardLayout.jsx's previous inline
 * bell/dropdown block into a standalone, self-contained component —
 * owns its own fetch/poll/state, so DashboardLayout.jsx just renders
 * <NotificationBell /> instead of holding notification state itself.
 *
 * Polls unread count every 60s (matches this being a low-urgency,
 * non-realtime feature per the sprint brief's silence on WebSockets/
 * push — polling is the right complexity level here, no new
 * infrastructure needed) rather than fetching the full list
 * repeatedly; the full list is only fetched when the dropdown opens
 * or after a mutation (mark read/mark all read).
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const refreshUnreadCount = async () => {
    const { data, error } = await getUnreadCount();
    if (!error) setUnreadCount(data);
  };

  const refreshList = async () => {
    setLoading(true);
    const { data, error } = await getNotifications({ page: 1, limit: 5 });
    setLoading(false);
    if (!error) setNotifications(data);
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) refreshList();
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    const { error } = await markNotificationAsRead(id);
    if (error) toast.error('Unable to update notification.', { style: TOAST_STYLE });
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    const { error } = await markAllNotificationsAsRead();
    if (error) {
      toast.error('Unable to mark all as read.', { style: TOAST_STYLE });
      refreshList();
      refreshUnreadCount();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          loading={loading}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
