/**
 * Notification Controller
 * ------------------------------------------------------------------
 * Table: notifications
 * Columns: id, user_id, title, message, type, is_read, created_at
 */

const { supabaseAdmin } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { applyWorkspaceScope, workspaceIdForInsert } = require("../utils/workspaceScope");

// @desc    Get all notifications for the authenticated user
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  query = applyWorkspaceScope(query, req);

  const { data, error } = await query;

  if (error) throw new ApiError(500, "Failed to fetch notifications", error.message);

  return sendSuccess(res, { message: "Notifications fetched successfully", data: data || [] });
});

// @desc    Create a notification
// @route   POST /api/notifications
// @access  Private
const createNotification = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, message, type } = req.body;

  const payload = {
    user_id: userId,
    title,
    message,
    type: type || "info",
    is_read: false,
    workspace_id: workspaceIdForInsert(req),
  };

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert([payload])
    .select("*")
    .single();

  if (error) throw new ApiError(500, "Failed to create notification", error.message);

  return sendSuccess(res, { statusCode: 201, message: "Notification created successfully", data });
});

// @desc    Update a notification (e.g. mark as read/unread)
// @route   PUT /api/notifications/:id
// @access  Private
const updateNotification = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { isRead, title, message, type } = req.body;

  const payload = {
    ...(isRead !== undefined && { is_read: isRead }),
    ...(title !== undefined && { title }),
    ...(message !== undefined && { message }),
    ...(type !== undefined && { type }),
  };

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to update notification", error.message);
  if (!data) throw new ApiError(404, "Notification not found");

  return sendSuccess(res, { message: "Notification updated successfully", data });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .select("id");

  if (error) throw new ApiError(500, "Failed to mark notifications as read", error.message);

  return sendSuccess(res, {
    message: "All notifications marked as read",
    data: { updatedCount: data?.length || 0 },
  });
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to delete notification", error.message);
  if (!data) throw new ApiError(404, "Notification not found");

  return sendSuccess(res, { message: "Notification deleted successfully", data: { id } });
});

module.exports = {
  getNotifications,
  createNotification,
  updateNotification,
  markAllAsRead,
  deleteNotification,
};
