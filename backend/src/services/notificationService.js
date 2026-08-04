/**
 * Notification Service
 * ------------------------------------------------------------------
 * Sprint 14. Subscribes to eventBusService (wired in
 * registerSubscribers.js) and turns published events into
 * `notifications` rows. Publishers (leave/expense/payroll/etc.
 * services) are responsible for resolving WHO should be notified —
 * per eventTypes.js's documented payload contract, every event
 * includes `recipientUserIds: string[]` — this service's only job is
 * "given recipients and event details, write the rows, respecting
 * each recipient's mute preference." Recipient-resolution logic (e.g.
 * "who is the approver for this expense") stays in each module's own
 * service, since that's domain knowledge this generic service
 * shouldn't need to know.
 *
 * Also exports listNotifications/markAsRead/markAllAsRead/deleteNotification/
 * getUnreadCount as the service-layer functions the upcoming
 * notificationController.js rewrite calls — this file is both the
 * event subscriber AND the CRUD service layer, since both need the
 * same repository and there's no reason to split them into two files
 * for one small module.
 */

const ApiError = require("../utils/ApiError");
const notificationRepository = require("../repositories/notificationRepository");
const notificationPreferenceRepository = require("../repositories/notificationPreferenceRepository");
const { EVENT_TYPE_VALUES } = require("../events/eventTypes");

/**
 * Event handler — registered against every EVENT_TYPES value in
 * registerSubscribers.js. Filters out recipients who've muted this
 * event type, then writes one row per remaining recipient in a single
 * bulk insert.
 *
 * Deliberately swallows its own errors after logging (never throws)
 * — this runs inside eventBusService.publish()'s Promise.allSettled,
 * which already isolates failures, but defense-in-depth here means a
 * bug in this handler can never surface as an unhandled rejection.
 */
async function handleEvent(eventType, payload = {}) {
  const {
    workspaceId,
    recipientUserIds = [],
    resourceType = null,
    resourceId = null,
    title,
    message = null,
    actionUrl = null,
  } = payload;

  if (!workspaceId) {
    console.error(`[notificationService] Event "${eventType}" published with no workspaceId — skipped.`);
    return;
  }
  if (!recipientUserIds.length) {
    return; // Nothing to do — e.g. a system event with no one to notify yet.
  }
  if (!title) {
    console.error(`[notificationService] Event "${eventType}" published with no title — skipped.`);
    return;
  }

  try {
    const disabled = await notificationPreferenceRepository.findDisabledUserIds(
      recipientUserIds,
      workspaceId,
      eventType
    );

    const activeRecipients = recipientUserIds.filter((id) => !disabled.has(id));
    if (!activeRecipients.length) return;

    const rows = activeRecipients.map((userId) => ({
      workspace_id: workspaceId,
      user_id: userId,
      title,
      message,
      type: eventType,
      resource_type: resourceType,
      resource_id: resourceId,
      action_url: actionUrl,
      is_read: false,
    }));

    await notificationRepository.createMany(rows);
  } catch (err) {
    console.error(`[notificationService] Failed to create notifications for "${eventType}":`, err.message);
  }
}

// ----------------------------------------------------------------------------
// CRUD service layer (backs notificationController.js's rewrite)
// ----------------------------------------------------------------------------

async function listNotifications(userId, workspaceId, query = {}) {
  const { page, limit, search, type, is_read } = query;

  if (type !== undefined && !EVENT_TYPE_VALUES.has(type) && !["info", "leave", "payroll", "expense"].includes(type)) {
    throw new ApiError(400, "Unrecognized notification type filter");
  }

  return notificationRepository.listForUser(userId, workspaceId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: search ? String(search).trim() : undefined,
    type,
    isRead: is_read !== undefined ? is_read === "true" || is_read === true : undefined,
  });
}

async function getUnreadCount(userId, workspaceId) {
  return notificationRepository.getUnreadCount(userId, workspaceId);
}

async function markAsRead(id, userId, isRead = true) {
  const existing = await notificationRepository.findByIdForUser(id, userId);
  if (!existing) throw new ApiError(404, "Notification not found");
  return notificationRepository.markRead(id, userId, isRead);
}

async function markAllAsRead(userId, workspaceId) {
  const updated = await notificationRepository.markAllRead(userId, workspaceId);
  return { updatedCount: updated.length };
}

async function deleteNotification(id, userId) {
  const existing = await notificationRepository.findByIdForUser(id, userId);
  if (!existing) throw new ApiError(404, "Notification not found");
  await notificationRepository.remove(id, userId);
  return { id };
}

module.exports = {
  handleEvent,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
