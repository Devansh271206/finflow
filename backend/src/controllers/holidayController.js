/**
 * Holiday Controller
 * ------------------------------------------------------------------
 * Table: holiday_calendar (migration 017)
 *
 * Route protection (see holidayRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.HOLIDAYS_*)
 *
 * Sprint 13 RBAC:
 *   - Read (list, get, range): Employee, Manager, HR, Admin
 *     (HOLIDAYS_READ, broad — see migration 018)
 *   - Create/Update/Delete: Organization Admin only
 *     (HOLIDAYS_MANAGE, narrow — see migration 018)
 *
 * Follows routes -> controllers -> services -> repositories layering
 * (PRD §14), same as departmentController.js / leaveTypeController.js.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const holidayService = require("../services/holidayService");

function requireWorkspace(req) {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }
}

// @desc    List all holidays in the resolved workspace (unbounded by
//          date — admin management view)
// @route   GET /api/holidays?search=&type=&sort_by=&sort_order=
// @access  Member (holidays.read)
const getHolidays = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const { search, type, sort_by, sort_order } = req.query;

  const holidays = await holidayService.listHolidays(req.workspace.id, {
    search,
    type,
    sortBy: sort_by,
    sortOrder: sort_order,
  });

  return sendSuccess(res, { message: "Holidays fetched", data: holidays });
});

// @desc    Get holiday occurrences (recurring rows projected) within a
//          date range — the primary feed for the enterprise calendar.
// @route   GET /api/holidays/range?start=YYYY-MM-DD&end=YYYY-MM-DD
// @access  Member (holidays.read)
const getHolidaysInRange = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const { start, end } = req.query;
  const occurrences = await holidayService.getHolidaysInRange(req.workspace.id, start, end);

  return sendSuccess(res, { message: "Holiday occurrences fetched", data: occurrences });
});

// @desc    Get a single holiday by id
// @route   GET /api/holidays/:id
// @access  Member (holidays.read)
const getHolidayById = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const holiday = await holidayService.getHoliday(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Holiday fetched", data: holiday });
});

// @desc    Create a holiday
// @route   POST /api/holidays
// @access  Organization Admin (holidays.manage)
const createHoliday = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const holiday = await holidayService.createHoliday(req.workspace.id, req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, message: "Holiday created", data: holiday });
});

// @desc    Update a holiday
// @route   PATCH /api/holidays/:id
// @access  Organization Admin (holidays.manage)
const updateHoliday = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const holiday = await holidayService.updateHoliday(
    req.params.id,
    req.workspace.id,
    req.body,
    req.user.id
  );
  return sendSuccess(res, { message: "Holiday updated", data: holiday });
});

// @desc    Delete a holiday
// @route   DELETE /api/holidays/:id
// @access  Organization Admin (holidays.manage)
const deleteHoliday = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const result = await holidayService.deleteHoliday(req.params.id, req.workspace.id, req.user.id);
  return sendSuccess(res, { message: "Holiday deleted", data: result });
});

module.exports = {
  getHolidays,
  getHolidaysInRange,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
