/**
 * Holiday Service
 * ------------------------------------------------------------------
 * Sprint 13: Enterprise Onboarding & Calendar Experience, Part 2.
 * Follows the same routes -> controllers -> services -> repositories
 * layering (PRD §14) as every other module (see leaveTypeService.js
 * for the closest analog — same validation / duplicate-check / audit
 * pattern is reused here).
 *
 * Owns:
 *   - Validation + duplicate-checking for holiday CRUD
 *   - Audit logging (holiday.create / holiday.update / holiday.delete)
 *   - Recurring-holiday date projection: turns a recurring row's
 *     stored (arbitrary-year) month/day into concrete occurrences
 *     within a requested [start, end] range, including correctly
 *     handling ranges that span a Dec 31 -> Jan 1 boundary.
 *
 * getHolidaysInRange() is the single function both
 * calendarAggregationService.js (calendar views) and
 * leaveRequestService.js (holiday-day exclusion, resolving the TODO
 * left there since Sprint 9) are expected to call — neither should
 * re-implement recurrence projection themselves.
 */

const ApiError = require("../utils/ApiError");
const holidayRepository = require("../repositories/holidayRepository");
const auditLogRepository = require("../repositories/auditLogRepository");
const membershipRepository = require("../repositories/membershipRepository");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");

const VALID_TYPES = new Set(["public", "organization"]);

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Projects a single recurring holiday row onto every calendar year that
 * overlaps [startDate, endDate], returning one occurrence object per
 * matching year. A recurring holiday anchored on Dec 25 queried against
 * a range spanning two years yields two occurrences (Dec 25 of each
 * year), same as any other recurring-event calendar.
 */
function projectRecurringHoliday(holiday, startDate, endDate) {
  const anchor = toDateOnly(holiday.date);
  if (!anchor) return [];

  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (!start || !end) return [];

  const month = anchor.getUTCMonth();
  const day = anchor.getUTCDate();
  const occurrences = [];

  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    // Guards against Feb 29 anchors projected onto non-leap years.
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (day > daysInMonth) continue;

    const occurrenceDateStr = formatDate(year, month, day);
    const occurrence = toDateOnly(occurrenceDateStr);
    if (occurrence >= start && occurrence <= end) {
      occurrences.push({ ...holiday, date: occurrenceDateStr, occurrence_of: holiday.id });
    }
  }

  return occurrences;
}

/**
 * Returns every holiday occurrence (recurring instances already
 * projected, non-recurring rows returned as-is) that falls within
 * [startDate, endDate], sorted by date. startDate/endDate are
 * "YYYY-MM-DD" strings, inclusive on both ends.
 */
async function getHolidaysInRange(workspaceId, startDate, endDate) {
  if (!startDate || !endDate) {
    throw new ApiError(400, "startDate and endDate are required");
  }
  if (toDateOnly(startDate) === null || toDateOnly(endDate) === null) {
    throw new ApiError(400, "startDate and endDate must be valid dates");
  }
  if (toDateOnly(startDate) > toDateOnly(endDate)) {
    throw new ApiError(400, "startDate must not be after endDate");
  }

  const { nonRecurring, recurring } = await holidayRepository.listInRange(
    workspaceId,
    startDate,
    endDate
  );

  const projected = recurring.flatMap((h) => projectRecurringHoliday(h, startDate, endDate));

  return [...nonRecurring, ...projected].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * List all holidays for the admin management screen (unbounded by
 * date — includes past years, and recurring rows are NOT projected
 * here since the admin is editing the source row, not viewing
 * occurrences). Mirrors leaveTypeService.listLeaveTypes()'s query
 * parsing.
 */
async function listHolidays(workspaceId, query = {}) {
  const { search, type, sortBy, sortOrder } = query;

  if (type !== undefined && !VALID_TYPES.has(type)) {
    throw new ApiError(400, "type must be one of: public, organization");
  }

  return holidayRepository.listByWorkspace(workspaceId, {
    search: search ? String(search).trim() : undefined,
    type,
    sortBy,
    sortOrder,
  });
}

async function getHoliday(id, workspaceId) {
  const holiday = await holidayRepository.findByIdInWorkspace(id, workspaceId);
  if (!holiday) throw new ApiError(404, "Holiday not found");
  return holiday;
}

function validatePayload({ name, date, type, is_recurring_annual }, { partial = false } = {}) {
  const payload = {};

  if (!partial || name !== undefined) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      throw new ApiError(400, "Holiday name is required");
    }
    payload.name = trimmedName;
  }

  if (!partial || date !== undefined) {
    if (toDateOnly(date) === null) {
      throw new ApiError(400, "A valid date (YYYY-MM-DD) is required");
    }
    payload.date = date;
  }

  if (!partial || type !== undefined) {
    const resolvedType = type || "organization";
    if (!VALID_TYPES.has(resolvedType)) {
      throw new ApiError(400, "type must be one of: public, organization");
    }
    payload.type = resolvedType;
  }

  if (is_recurring_annual !== undefined) {
    payload.is_recurring_annual = Boolean(is_recurring_annual);
  }

  return payload;
}

async function createHoliday(workspaceId, body, actorUserId) {
  const payload = validatePayload(body);

  const duplicate = await holidayRepository.findByWorkspaceDateAndName(
    workspaceId,
    payload.date,
    payload.name
  );
  if (duplicate) {
    throw new ApiError(409, "A holiday with this name already exists on this date");
  }

  const holiday = await holidayRepository.create({
    workspace_id: workspaceId,
    name: payload.name,
    date: payload.date,
    description: body.description ? String(body.description).trim() : null,
    type: payload.type,
    is_recurring_annual: payload.is_recurring_annual ?? false,
    created_by: actorUserId,
  });

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "holiday.create",
      resourceType: "holiday",
      resourceId: holiday.id,
      metadata: { name: holiday.name, date: holiday.date, type: holiday.type },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record holiday.create:", auditError.message);
  }

  // HOLIDAY_ADDED deliberately broadcasts to every active workspace
  // member, not just Admin/HR (resolveAdminHRUserIds's usual scope) —
  // a new holiday affects everyone's calendar, unlike department/team/
  // vendor/budget changes which are org-management-facing.
  membershipRepository
    .listByWorkspace(workspaceId)
    .then((members) => {
      const recipientUserIds = (members || [])
        .filter((m) => m.status === "active")
        .map((m) => m.user_id)
        .filter(Boolean);

      eventBusService.publish(EVENT_TYPES.HOLIDAY_ADDED, {
        workspaceId,
        actorUserId,
        recipientUserIds,
        module: "Holiday",
        resourceType: "holiday",
        resourceId: holiday.id,
        title: `New holiday added: ${holiday.name}`,
        message: holiday.date,
        actionUrl: `/calendar`,
        metadata: { date: holiday.date, type: holiday.type },
      });
    })
    .catch((err) => console.error("[holidayService] Failed to resolve recipients for HOLIDAY_ADDED event:", err.message));

  return holiday;
}

async function updateHoliday(id, workspaceId, body, actorUserId) {
  const existing = await holidayRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Holiday not found");

  const payload = validatePayload(body, { partial: true });

  if (
    (payload.name !== undefined || payload.date !== undefined) &&
    !(payload.name === undefined && payload.date === undefined)
  ) {
    const candidateName = payload.name !== undefined ? payload.name : existing.name;
    const candidateDate = payload.date !== undefined ? payload.date : existing.date;
    const changed = candidateName.toLowerCase() !== existing.name.toLowerCase() || candidateDate !== existing.date;

    if (changed) {
      const duplicate = await holidayRepository.findByWorkspaceDateAndName(
        workspaceId,
        candidateDate,
        candidateName
      );
      if (duplicate && duplicate.id !== id) {
        throw new ApiError(409, "A holiday with this name already exists on this date");
      }
    }
  }

  if (body.description !== undefined) {
    payload.description = body.description ? String(body.description).trim() : null;
  }

  const updated = await holidayRepository.update(id, payload);

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "holiday.update",
      resourceType: "holiday",
      resourceId: id,
      metadata: { changes: payload },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record holiday.update:", auditError.message);
  }

  return updated;
}

async function deleteHoliday(id, workspaceId, actorUserId) {
  const existing = await holidayRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Holiday not found");

  await holidayRepository.remove(id);

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "holiday.delete",
      resourceType: "holiday",
      resourceId: id,
      metadata: { name: existing.name, date: existing.date },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record holiday.delete:", auditError.message);
  }

  return { id };
}

module.exports = {
  listHolidays,
  getHoliday,
  getHolidaysInRange,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
