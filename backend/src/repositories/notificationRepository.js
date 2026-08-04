/**
 * Notification Repository
 * ------------------------------------------------------------------
 * Data-access layer for `notifications` (extended by migration 019).
 * Replaces the direct supabaseAdmin calls currently embedded in
 * notificationController.js — this repository is what the upcoming
 * controller rewrite and notificationService.js both build on,
 * following the same repository/service split every other module in
 * this codebase already uses (departmentRepository.js, etc.).
 *
 * essService.js's getNotificationSummary() also duplicates this exact
 * query today (documented in its own header as "kept inline since
 * that controller has no service layer to import from") — now that
 * one exists, essService.js should be updated to call
 * listForUser()/getUnreadCount() from here instead. Flagged as a
 * follow-up file, not done in this file (essService.js wasn't in this
 * sprint's explicit file list — touching it deserves its own reviewed
 * change, same posture taken with companyController.js in Sprint 13).
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, user_id, title, message, type, is_read, " +
  "resource_type, resource_id, action_url, created_at";

const SORTABLE_COLUMNS = new Set(["created_at", "type"]);

/**
 * Paginated, filterable list of a single user's notifications —
 * backs both the Notification Center page (full pagination/search/
 * filter) and the navbar dropdown (page=1, limit=5, no filters).
 */
async function listForUser(
  userId,
  workspaceId,
  { page = 1, limit = 20, search, type, isRead, sortBy = "created_at", sortOrder = "desc" } = {}
) {
  const column = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "created_at";
  const ascending = sortOrder !== "desc";
  const from = (Math.max(1, page) - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from("notifications")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order(column, { ascending })
    .range(from, to);

  if (search) {
    // Matches either title or message — ilike on two columns requires
    // an .or() filter rather than chained .ilike() calls (which AND).
    query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  }
  if (type) {
    query = query.eq("type", type);
  }
  if (isRead !== undefined) {
    query = query.eq("is_read", isRead);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count || 0 };
}

async function getUnreadCount(userId, workspaceId) {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_read", false);

  if (error) throw error;
  return count || 0;
}

async function findByIdForUser(id, userId) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Single insert — used when an event has exactly one recipient (e.g.
 * leave_approved notifying just the requester).
 */
async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Bulk insert — used when an event fans out to multiple recipients
 * (e.g. organization_announcement notifying every workspace member,
 * or expense_submitted notifying every eligible approver). One
 * round-trip instead of N, same reasoning as this codebase's other
 * bulk-insert call sites (e.g. categoryService.seedDefaultsForWorkspace).
 */
async function createMany(payloads) {
  if (!payloads || payloads.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert(payloads)
    .select(SELECT_COLUMNS);
  if (error) throw error;
  return data;
}

async function markRead(id, userId, isRead = true) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: isRead })
    .eq("id", id)
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markAllRead(userId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_read", false)
    .select("id");
  if (error) throw error;
  return data || [];
}

async function remove(id, userId) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  listForUser,
  getUnreadCount,
  findByIdForUser,
  create,
  createMany,
  markRead,
  markAllRead,
  remove,
  SELECT_COLUMNS,
};
