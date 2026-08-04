import { apiGet, apiPost, apiPut, apiDelete } from "../lib/apiClient";

/**
 * Frontend API client for /api/notifications (backend/src/routes/notificationRoutes.js,
 * rewritten Sprint 14). All three original exports (getNotifications,
 * markNotificationAsRead, markAllNotificationsAsRead) are preserved
 * with their exact names and call signatures — DashboardLayout.jsx and
 * NotificationsTab.jsx (not yet updated in this sprint's file order)
 * keep working unchanged. getNotifications() now accepts an optional
 * params object for the new Notification Center page; calling it with
 * no arguments (the existing call sites' behavior) is unchanged.
 */

/**
 * params (all optional): { page, limit, search, type, is_read }
 * Returns { data, error, meta } — meta.total is the full count for
 * pagination (see apiClient's pass-through of the backend's `meta`
 * response field, same shape Departments.jsx's service already relies on).
 */
export async function getNotifications(params = {}) {
  try {
    const { data, error, meta } = await apiGet("/notifications", params);
    return { data: Array.isArray(data) ? data : [], error, meta };
  } catch (error) {
    return { data: [], error, meta: null };
  }
}

export async function getUnreadCount() {
  try {
    const { data, error } = await apiGet("/notifications/unread-count");
    return { data: data?.count ?? 0, error };
  } catch (error) {
    return { data: 0, error };
  }
}

export async function markNotificationAsRead(id, isRead = true) {
  try {
    return await apiPut(`/notifications/${id}`, { isRead });
  } catch (error) {
    return { data: null, error };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    return await apiPut(`/notifications/read-all`);
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteNotification(id) {
  try {
    return await apiDelete(`/notifications/${id}`);
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Broadcasts an Organization Announcement notification to every active
 * workspace member. Organization Admin only (notifications.manage) —
 * enforced server-side; this is a UI convenience, not the real gate.
 */
export async function createAnnouncement({ title, message }) {
  try {
    return await apiPost("/notifications", { title, message });
  } catch (error) {
    return { data: null, error };
  }
}
