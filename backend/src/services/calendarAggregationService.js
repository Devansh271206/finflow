/**
 * Calendar Aggregation Service
 * ------------------------------------------------------------------
 * Sprint 13, Part 2: Organization Calendar. Pure read-aggregation layer
 * per PRD §15.17 ("This is a read aggregation layer — no new write path
 * beyond what each source module already owns, so it introduces no new
 * source-of-truth conflicts"). Merges three existing sources into one
 * normalized event feed for the enterprise calendar UI:
 *
 *   1. Leave (approved + pending) — via leaveRequestService.listLeaveRequests()
 *   2. Holidays (public + organization, recurring projected) — via
 *      holidayService.getHolidaysInRange()
 *   3. Weekends — computed from the workspace's configured weekend days
 *
 * Role-aware visibility (PRD §15.17 / Sprint 13 RBAC table):
 *   - Employee: own leave + org-wide holidays/weekends
 *   - Manager (Department Lead): above + their department's leave
 *     (approved + pending, so they can see what's awaiting their action)
 *   - HR / Organization Admin: all leave workspace-wide
 *
 * NOTE on weekend configuration: Sprint 13's onboarding Step 3 collects
 * "Weekend Configuration", but no workspace column for it exists in the
 * schema inspected for this sprint (workspaces currently has no
 * weekend_days-equivalent field). Rather than guessing a column name
 * that doesn't exist yet, this service defaults to the conventional
 * Saturday/Sunday weekend and exposes a `weekendDays` parameter so the
 * caller (onboarding's WorkspaceInitStep / a future workspace-settings
 * read) can override it once that column is confirmed and added — see
 * this sprint's onboarding files for where that config will actually be
 * persisted.
 */

const holidayService = require("./holidayService");
const leaveRequestService = require("./leaveRequestService");
const employeeRepository = require("../repositories/employeeRepository");

const DEFAULT_WEEKEND_DAYS = [0, 6]; // Sunday, Saturday (JS Date.getDay())

const LEAVE_STATUS_COLORS = {
  approved: "#10b981", // green
  dept_approved: "#10b981",
  pending: "#f59e0b", // yellow/amber
};

const HOLIDAY_TYPE_COLORS = {
  public: "#ef4444", // red
  organization: "#3b82f6", // blue
};

const WEEKEND_COLOR = "#6b7280"; // gray

/**
 * Same "membership -> employee_id" resolution leaveRequestController.js
 * duplicates locally (that helper isn't exported) — kept in sync with
 * that file's implementation rather than newly invented here.
 */
async function resolveActorEmployeeId(userId, workspaceId) {
  if (!userId || !workspaceId) return null;
  const employee = await employeeRepository.findByUserIdInWorkspace(userId, workspaceId);
  return employee?.id || null;
}

function iterateDates(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function buildWeekendEvents(startDate, endDate, weekendDays) {
  const days = new Set(weekendDays && weekendDays.length ? weekendDays : DEFAULT_WEEKEND_DAYS);
  return iterateDates(startDate, endDate)
    .filter((dateStr) => days.has(new Date(`${dateStr}T00:00:00Z`).getUTCDay()))
    .map((dateStr) => ({
      id: `weekend-${dateStr}`,
      type: "weekend",
      date: dateStr,
      title: "Weekend",
      color: WEEKEND_COLOR,
    }));
}

function buildHolidayEvents(holidayOccurrences) {
  return holidayOccurrences.map((h) => ({
    id: `holiday-${h.id}-${h.date}`,
    type: h.type === "public" ? "public_holiday" : "organization_holiday",
    date: h.date,
    title: h.name,
    description: h.description || null,
    color: HOLIDAY_TYPE_COLORS[h.type] || HOLIDAY_TYPE_COLORS.organization,
    isRecurring: Boolean(h.is_recurring_annual),
  }));
}

/**
 * Expands a leave request (which spans start_date..end_date) into one
 * event per day, so the calendar can render a dot/bar on every day the
 * employee is out, not just the start date.
 */
function buildLeaveEvents(leaveRequests) {
  const events = [];
  for (const request of leaveRequests) {
    const days = iterateDates(request.start_date, request.end_date);
    for (const dateStr of days) {
      events.push({
        id: `leave-${request.id}-${dateStr}`,
        type: request.status === "pending" ? "pending_leave" : "approved_leave",
        date: dateStr,
        title: request.employee?.full_name
          ? `${request.employee.full_name} — Leave`
          : "Leave",
        status: request.status,
        employeeId: request.employee_id,
        employeeName: request.employee?.full_name || null,
        leaveRequestId: request.id,
        isHalfDay: Boolean(request.is_half_day),
        color: LEAVE_STATUS_COLORS[request.status] || LEAVE_STATUS_COLORS.pending,
      });
    }
  }
  return events;
}

/**
 * Role-scopes which leave requests are visible, mirroring
 * leaveRequestController.js's isAdmin/isHR/isDeptLead checks (PRD §15.17
 * "role-aware visibility"). Returns the leaveRequestService query
 * options appropriate for the caller's role.
 */
async function resolveLeaveScope({ workspaceId, userId, roleKey }) {
  const normalizedRole = String(roleKey || "").toUpperCase();
  const isAdminOrHR = ["ADMIN", "OWNER", "FOUNDER", "HR"].includes(normalizedRole);

  if (isAdminOrHR) {
    return {}; // no employee/department filter — full workspace visibility
  }

  if (normalizedRole === "DEPARTMENT_LEAD") {
    const employee = await employeeRepository.findByUserIdInWorkspace(userId, workspaceId);
    if (employee?.department_id) {
      return { department_id: employee.department_id };
    }
    // Dept Lead with no resolved department falls back to own-leave-only
    // rather than throwing, same fail-safe posture as leaveBalanceController.js.
  }

  // Employee (or any unrecognized role) — own leave only.
  const employeeId = await resolveActorEmployeeId(userId, workspaceId);
  return employeeId ? { employee_id: employeeId } : { employee_id: "__none__" };
}

/**
 * Main entry point. Returns a flat, sorted array of calendar events for
 * [startDate, endDate], merging leave + holidays + weekends, scoped to
 * what the caller's role is allowed to see.
 */
async function getEvents({
  workspaceId,
  userId,
  roleKey,
  startDate,
  endDate,
  weekendDays,
  includeWeekends = true,
  includeHolidays = true,
  includeLeave = true,
}) {
  const events = [];

  if (includeLeave) {
    const leaveScope = await resolveLeaveScope({ workspaceId, userId, roleKey });
    const leaveRequests = await leaveRequestService.listLeaveRequests(workspaceId, {
      ...leaveScope,
      start_date_from: startDate,
      start_date_to: endDate,
    });
    const relevantLeave = (leaveRequests.data || leaveRequests).filter((r) =>
      ["approved", "dept_approved", "pending"].includes(r.status)
    );
    events.push(...buildLeaveEvents(relevantLeave));
  }

  if (includeHolidays) {
    const holidayOccurrences = await holidayService.getHolidaysInRange(
      workspaceId,
      startDate,
      endDate
    );
    events.push(...buildHolidayEvents(holidayOccurrences));
  }

  if (includeWeekends) {
    events.push(...buildWeekendEvents(startDate, endDate, weekendDays));
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

module.exports = { getEvents };
