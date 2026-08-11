/**
 * Leave Request Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `leave_requests`. Mirrors the shape of departmentRepository.js /
 * leaveTypeRepository.js (PRD §10.1 — services never touch Supabase
 * query syntax directly).
 *
 * Table: leave_requests
 * Columns: id, workspace_id, employee_id, leave_type_id, start_date,
 *          end_date, is_half_day, half_day_period, reason, status,
 *          submitted_at, decided_at, decided_by, created_at, updated_at
 * Status values: pending, dept_approved, approved, rejected, cancelled
 *
 * All status transitions (approve/reject/cancel) go through update()
 * here but the actual business rules (who may transition from what
 * to what, balance side-effects) live in leaveRequestService.js —
 * this repository has no opinion on the state machine.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, employee_id, leave_type_id, start_date, end_date, is_half_day, " +
  "half_day_period, reason, status, submitted_at, decided_at, decided_by, created_at, updated_at, " +
  "leave_type:leave_type_id ( id, name, is_paid ), " +
  "employee:employee_id ( id, full_name, department_id )";

// Statuses that still "hold" a date range for conflict-detection
// purposes — a rejected or cancelled request no longer blocks new
// requests over the same dates.
const ACTIVE_STATUSES = ["pending", "dept_approved", "approved"];

const SORTABLE_COLUMNS = new Set(["start_date", "end_date", "submitted_at", "status"]);

/**
 * List leave requests for a workspace with optional filters. Supports
 * the Manager Leave Dashboard (department_id filter, via the joined
 * employee relation) and Employee Leave History (employee_id filter)
 * from the same query shape, plus search/status/date-range filtering
 * and pagination — mirrors departmentRepository.js's
 * listByWorkspace() options pattern.
 */
async function listByWorkspace(
  workspaceId,
  {
    employeeId,
    departmentId,
    leaveTypeId,
    status,
    startDateFrom,
    startDateTo,
    search,
    sortBy = "submitted_at",
    sortOrder = "desc",
    page,
    limit,
  } = {}
) {
  const column = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "submitted_at";
  const ascending = sortOrder === "asc";

  let query = supabaseAdmin
    .from("leave_requests")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order(column, { ascending });

  if (employeeId) query = query.eq("employee_id", employeeId);
  if (leaveTypeId) query = query.eq("leave_type_id", leaveTypeId);
  if (status) query = query.eq("status", status);
  if (startDateFrom) query = query.gte("start_date", startDateFrom);
  if (startDateTo) query = query.lte("start_date", startDateTo);
  if (search) query = query.ilike("reason", `%${search}%`);
  // Manager Leave Dashboard scoping — filter on the joined employee's
  // department. Same embedded-filter caveat as
  // leaveBalanceRepository.findByDepartment(): confirmed with a JS-side
  // filter below rather than trusted on the query alone.
  if (departmentId) query = query.eq("employee.department_id", departmentId);

  const paginate = Number.isInteger(page) && Number.isInteger(limit);
  if (paginate) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const filtered = departmentId
    ? (data || []).filter((row) => row.employee && row.employee.department_id === departmentId)
    : data;

  if (paginate) {
    return { data: filtered, total: count ?? filtered.length, page, limit };
  }
  return filtered;
}

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms a leave request belongs to the given
 * workspace before the controller acts on it (defense-in-depth
 * alongside RLS).
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Conflict detection — active (pending/dept_approved/approved) leave
 * requests for this employee whose date range overlaps
 * [startDate, endDate]. Standard interval-overlap predicate:
 * existing.start_date <= newEnd AND existing.end_date >= newStart.
 * excludeRequestId lets leaveRequestService.js skip the request being
 * edited when checking for conflicts against itself.
 */
async function findOverlapping(employeeId, startDate, endDate, { excludeRequestId } = {}) {
  let query = supabaseAdmin
    .from("leave_requests")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .in("status", ACTIVE_STATUSES)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (excludeRequestId) {
    query = query.neq("id", excludeRequestId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — used for both editing a pending request's fields
 * (dates/reason) and for status transitions (approve/reject/cancel),
 * which also set decided_at/decided_by. No delete() — leave requests
 * are never hard-deleted, only moved to the 'cancelled' status
 * (PRD §15.16 "Leave Cancellation").
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  listByWorkspace,
  findById,
  findByIdInWorkspace,
  findOverlapping,
  create,
  update,
  SELECT_COLUMNS,
  SORTABLE_COLUMNS,
  ACTIVE_STATUSES,
};  