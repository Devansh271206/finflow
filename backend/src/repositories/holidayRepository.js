/**
 * Holiday Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `holiday_calendar` (migration 017). Mirrors the shape of
 * departmentRepository.js / leaveEventRepository.js (PRD §10.1 —
 * services never touch Supabase query syntax directly).
 *
 * Table: holiday_calendar
 * Columns: id, workspace_id, name, date, description, type
 *          ('public' | 'organization'), is_recurring_annual,
 *          created_by, created_at, updated_at
 *
 * listInRange() is the primary consumer-facing read: both
 * calendarAggregationService.js (calendar views) and
 * leaveRequestService.js (holiday-day exclusion from leave counting)
 * need "every holiday visible within [start, end]", including
 * recurring holidays anchored in a *different* calendar year than the
 * query range. Recurring projection is handled here rather than in
 * every caller, so the "does this recurring holiday fall in range"
 * logic exists in exactly one place.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, name, date, description, type, is_recurring_annual, " +
  "created_by, created_at, updated_at";

// Whitelist of columns listByWorkspace() may sort on — never interpolate
// req.query.sortBy directly into the query builder.
const SORTABLE_COLUMNS = new Set(["date", "name", "type", "created_at"]);

/**
 * List all holidays for a workspace (unbounded by date), optionally
 * filtered by type and/or a case-insensitive name search. Used by the
 * Holiday Management admin screen, which needs the full list (including
 * past years) rather than a date-windowed view.
 */
async function listByWorkspace(
  workspaceId,
  { type, search, sortBy = "date", sortOrder = "asc" } = {}
) {
  const column = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "date";
  const ascending = sortOrder !== "desc";

  let query = supabaseAdmin
    .from("holiday_calendar")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order(column, { ascending });

  if (type) {
    query = query.eq("type", type);
  }
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Date-range read used by the calendar aggregation layer and leave-day
 * exclusion. Returns two kinds of rows:
 *   1. Non-recurring holidays whose `date` literally falls in range.
 *   2. Recurring holidays (is_recurring_annual = true) whose month/day
 *      falls in range in ANY year — the caller (calendarAggregationService)
 *      is responsible for projecting these onto the queried year(s),
 *      since Postgres/Supabase's query builder can't cleanly express
 *      "month/day between" across a year boundary (e.g. Dec 28–Jan 3) in
 *      one filter. This function intentionally returns a superset
 *      (all recurring rows for the workspace) for the service layer to
 *      project and filter precisely.
 */
async function listInRange(workspaceId, startDate, endDate) {
  const [nonRecurring, recurring] = await Promise.all([
    supabaseAdmin
      .from("holiday_calendar")
      .select(SELECT_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("is_recurring_annual", false)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),
    supabaseAdmin
      .from("holiday_calendar")
      .select(SELECT_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("is_recurring_annual", true),
  ]);

  if (nonRecurring.error) throw nonRecurring.error;
  if (recurring.error) throw recurring.error;

  return {
    nonRecurring: nonRecurring.data,
    recurring: recurring.data,
  };
}

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("holiday_calendar")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms a holiday belongs to the given workspace
 * before the controller acts on it (defense-in-depth alongside RLS).
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("holiday_calendar")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Used by holidayService.js to block duplicate entries — same workspace,
 * same date, same name (a org could legitimately have two different
 * holidays land on the same date, so date alone isn't a strong-enough
 * duplicate signal).
 */
async function findByWorkspaceDateAndName(workspaceId, date, name) {
  const { data, error } = await supabaseAdmin
    .from("holiday_calendar")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("date", date)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("holiday_calendar")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("holiday_calendar")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Hard delete — unlike departments (soft-delete only per PRD §5.2),
 * holidays have no downstream transaction history referencing them, so
 * a hard delete is safe and matches the sprint brief's plain "Holiday
 * CRUD" requirement (no PRD note requiring soft-delete here).
 */
async function remove(id) {
  const { error } = await supabaseAdmin
    .from("holiday_calendar")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

module.exports = {
  listByWorkspace,
  listInRange,
  findById,
  findByIdInWorkspace,
  findByWorkspaceDateAndName,
  create,
  update,
  remove,
  SELECT_COLUMNS,
  SORTABLE_COLUMNS,
};
