/**
 * Activity Repository
 * ------------------------------------------------------------------
 * Data-access layer for `activity_feed` (migration 019). Backs the
 * Activity Feed page's role-scoped, paginated, filterable timeline.
 *
 * Row-level RBAC scoping (Admin=all, Manager=dept/team, Employee=own)
 * is NOT implemented as a join here — activity_feed.actor_user_id
 * references auth.users(id) directly, with no department_id column
 * of its own to join against (unlike leave_requests, which joins
 * through its employee relation for the same purpose in
 * leaveRequestRepository.js). Scoping is instead expressed as an
 * optional `actorUserIds` allowlist: activityService.js (upcoming)
 * resolves "which user ids are in this manager's department" via the
 * existing employeeRepository, then passes that list in here — same
 * "resolve scope in the service, filter in the repository" split
 * calendarAggregationService.js already established in Sprint 13
 * (resolveLeaveScope()).
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, actor_user_id, action, module, resource_type, resource_id, metadata, created_at";

const SORTABLE_COLUMNS = new Set(["created_at", "module"]);

/**
 * Paginated, filterable activity list for a workspace.
 *
 * @param {object} opts
 * @param {number} [opts.page]
 * @param {number} [opts.limit]
 * @param {string} [opts.search] - matches `action` (free text summary)
 * @param {string} [opts.module] - exact-match module facet filter
 * @param {string[]} [opts.actorUserIds] - if provided, restricts to
 *   activity performed by one of these users (Manager/Employee scope).
 *   Admin scope passes this as undefined/null for full visibility.
 */
async function listForWorkspace(
  workspaceId,
  { page = 1, limit = 20, search, module, actorUserIds, sortBy = "created_at", sortOrder = "desc" } = {}
) {
  const column = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "created_at";
  const ascending = sortOrder !== "desc";
  const from = (Math.max(1, page) - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from("activity_feed")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order(column, { ascending })
    .range(from, to);

  if (search) {
    query = query.ilike("action", `%${search}%`);
  }
  if (module) {
    query = query.eq("module", module);
  }
  if (actorUserIds) {
    // Explicitly-empty array (e.g. an Employee with no resolved own-
    // user-id yet) must return zero rows, not every row — Postgres'
    // `IN ()` with an empty list needs an explicit short-circuit since
    // Supabase's .in() with [] can behave inconsistently across
    // versions; safer to just return an empty page directly.
    if (actorUserIds.length === 0) {
      return { data: [], total: 0 };
    }
    query = query.in("actor_user_id", actorUserIds);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count || 0 };
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("activity_feed")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  listForWorkspace,
  create,
  SELECT_COLUMNS,
};
