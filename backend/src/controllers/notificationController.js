/**
 * Notification Controller
 * ------------------------------------------------------------------
 * Sprint 14 rewrite. Previously talked to Supabase directly (no
 * repository/service layer — the one module in this codebase that
 * didn't follow its own Repository/Service pattern). Now backed by
 * notificationService.js / notificationRepository.js, matching every
 * other module.
 *
 * BACKWARD COMPATIBILITY: the existing frontend (notificationService.js,
 * DashboardLayout.jsx, NotificationsTab.jsx — none updated yet in this
 * sprint's file order) calls:
 *   GET  /api/notifications
 *   PUT  /api/notifications/:id        body: { isRead }
 *   PUT  /api/notifications/read-all
 * All three verbs/paths are preserved exactly (see notificationRoutes.js,
 * next file) so nothing breaks before the frontend files catch up
 * later in this sprint's order. GET /api/notifications now ALSO
 * accepts ?page&limit&search&type&is_read for the new Notification
 * Center page — omitting them preserves the old "all notifications,
 * unpaginated" behavior's default shape closely enough that existing
 * callers (which just read the array) keep working, since
 * notificationRepository.listForUser()'s default limit (20) is larger
 * than any existing UI ever rendered anyway (dropdown slices to 5,
 * portal tab had no pagination to begin with).
 *
 * POST /api/notifications is repurposed from "create a notification
 * for myself" (dead code — nothing ever called it that way) into the
 * Organization Announcement broadcast endpoint, gated by
 * notifications.manage — this is the one notification type an admin
 * creates directly rather than the system generating it from a module
 * event, per the sprint brief's own list.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const notificationService = require("../services/notificationService");
const membershipRepository = require("../repositories/membershipRepository");
const eventBusService = require("../services/eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");

function requireWorkspace(req) {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }
}

// @desc    List the authenticated user's notifications (paginated,
//          searchable, filterable).
// @route   GET /api/notifications?page=&limit=&search=&type=&is_read=
// @access  Private (own notifications only)
const getNotifications = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const result = await notificationService.listNotifications(req.user.id, req.workspace.id, req.query);

  return sendSuccess(res, { message: "Notifications fetched successfully", data: result.data, meta: { total: result.total } });
});

// @desc    Unread count for the navbar bell badge.
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const count = await notificationService.getUnreadCount(req.user.id, req.workspace.id);
  return sendSuccess(res, { message: "Unread count fetched", data: { count } });
});

// @desc    Broadcast an Organization Announcement to every active
//          workspace member.
// @route   POST /api/notifications
// @access  Organization Admin (notifications.manage)
const createAnnouncement = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const { title, message } = req.body;
  if (!title) throw new ApiError(400, "title is required");

  const members = await membershipRepository.listByWorkspace(req.workspace.id);
  const recipientUserIds = (members || [])
    .filter((m) => m.status === "active")
    .map((m) => m.user_id)
    .filter(Boolean);

  // Fire-and-forget per eventBusService.js's documented call pattern —
  // the HTTP response doesn't wait on every recipient's row being
  // written, same non-blocking posture as auditLogRepository elsewhere.
  eventBusService.publish(EVENT_TYPES.ORGANIZATION_ANNOUNCEMENT, {
    workspaceId: req.workspace.id,
    actorUserId: req.user.id,
    recipientUserIds,
    module: "Organization",
    title,
    message: message || null,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Announcement is being sent",
    data: { recipientCount: recipientUserIds.length },
  });
});

// @desc    Update a notification (mark read/unread). Kept as PUT :id
//          for backward compatibility with the existing frontend.
// @route   PUT /api/notifications/:id
// @access  Private (own notification only)
const updateNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isRead } = req.body;

  const data = await notificationService.markAsRead(id, req.user.id, isRead !== undefined ? isRead : true);
  return sendSuccess(res, { message: "Notification updated successfully", data });
});

// @desc    Mark all of the caller's notifications as read.
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const result = await notificationService.markAllAsRead(req.user.id, req.workspace.id);
  return sendSuccess(res, { message: "All notifications marked as read", data: result });
});

// @desc    Delete a notification.
// @route   DELETE /api/notifications/:id
// @access  Private (own notification only)
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await notificationService.deleteNotification(id, req.user.id);
  return sendSuccess(res, { message: "Notification deleted successfully", data: result });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  createAnnouncement,
  updateNotification,
  markAllAsRead,
  deleteNotification,
};
