/**
 * Calendar Controller
 * ------------------------------------------------------------------
 * PRD §15.17 Company Calendar — read-aggregation endpoint only (no
 * writes; each event's source module owns its own write path).
 *
 * Route protection (see calendarRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.HOLIDAYS_READ)
 *
 * HOLIDAYS_READ is reused here rather than adding a fourth permission
 * key — it's already granted broadly to Employee/Manager/HR/Admin (same
 * set the calendar itself needs to reach), and the calendar is strictly
 * a superset read of holidays + leave + weekends, so a separate
 * "calendar.read" key would just duplicate the exact same grant set
 * migration 018 already created for holidays.read.
 *
 * req.membership is populated by resolveWorkspace (see
 * leaveRequestController.js for the same req.membership.roleKey usage
 * this controller mirrors for role-scoped visibility).
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const calendarAggregationService = require("../services/calendarAggregationService");

// @desc    Role-scoped, aggregated calendar events (leave + holidays +
//          weekends) for a date range.
// @route   GET /api/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD
//              &include=leave,holidays,weekends (optional, defaults to all)
// @access  Member (holidays.read)
const getCalendarEvents = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { start, end, include } = req.query;

  const includeSet = include
    ? new Set(String(include).split(",").map((s) => s.trim().toLowerCase()))
    : null;

  const events = await calendarAggregationService.getEvents({
    workspaceId: req.workspace.id,
    userId: req.user.id,
    roleKey: req.membership?.roleKey,
    startDate: start,
    endDate: end,
    includeLeave: includeSet ? includeSet.has("leave") : true,
    includeHolidays: includeSet ? includeSet.has("holidays") : true,
    includeWeekends: includeSet ? includeSet.has("weekends") : true,
  });

  return sendSuccess(res, { message: "Calendar events fetched", data: events });
});

module.exports = { getCalendarEvents };
