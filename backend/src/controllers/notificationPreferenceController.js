/**
 * Notification Preference Controller
 * ------------------------------------------------------------------
 * Sprint 14. Exposes the "Notification Preferences" feature from the
 * sprint brief's UI requirements. Merges the full EVENT_TYPES set with
 * the user's sparse notification_preferences rows (absence = enabled,
 * per migration 019's column comment) so the frontend always renders
 * a complete, deterministic list — it never has to reason about
 * "what happens if this event type has no row yet."
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const notificationPreferenceRepository = require("../repositories/notificationPreferenceRepository");
const { EVENT_TYPES, EVENT_TYPE_VALUES } = require("../events/eventTypes");

function requireWorkspace(req) {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }
}

// Human-readable labels for the preferences UI — kept here rather than
// in eventTypes.js so that file stays backend-event-semantics-only,
// not UI copy. Frontend could re-derive these, but a shared source
// avoids two places drifting on wording.
const EVENT_LABELS = {
  [EVENT_TYPES.LEAVE_SUBMITTED]: "Leave Submitted",
  [EVENT_TYPES.LEAVE_APPROVED]: "Leave Approved",
  [EVENT_TYPES.LEAVE_REJECTED]: "Leave Rejected",
  [EVENT_TYPES.EXPENSE_SUBMITTED]: "Expense Submitted",
  [EVENT_TYPES.EXPENSE_APPROVED]: "Expense Approved",
  [EVENT_TYPES.EXPENSE_REJECTED]: "Expense Rejected",
  [EVENT_TYPES.PAYROLL_GENERATED]: "Payroll Generated",
  [EVENT_TYPES.EMPLOYEE_CREATED]: "Employee Created",
  [EVENT_TYPES.EMPLOYEE_UPDATED]: "Employee Updated",
  [EVENT_TYPES.DEPARTMENT_CREATED]: "Department Created",
  [EVENT_TYPES.TEAM_CREATED]: "Team Created",
  [EVENT_TYPES.VENDOR_ADDED]: "Vendor Added",
  [EVENT_TYPES.BUDGET_EXCEEDED]: "Budget Exceeded",
  [EVENT_TYPES.BUDGET_UPDATED]: "Budget Updated",
  [EVENT_TYPES.ORGANIZATION_ANNOUNCEMENT]: "Organization Announcements",
  [EVENT_TYPES.HOLIDAY_ADDED]: "Holiday Added",
  [EVENT_TYPES.REPORT_GENERATED]: "Report Generated",
};

// @desc    List all 17 event types with the caller's current
//          enabled/disabled state (defaulting to enabled).
// @route   GET /api/notifications/preferences
// @access  Private
const getPreferences = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const rows = await notificationPreferenceRepository.listForUser(req.user.id, req.workspace.id);
  const overrideByEventType = new Map(rows.map((r) => [r.event_type, r]));

  const preferences = Object.values(EVENT_TYPES).map((eventType) => {
    const override = overrideByEventType.get(eventType);
    return {
      eventType,
      label: EVENT_LABELS[eventType] || eventType,
      isEnabled: override ? override.is_enabled : true,
    };
  });

  return sendSuccess(res, { message: "Notification preferences fetched", data: preferences });
});

// @desc    Toggle a single event type's notification preference.
// @route   PUT /api/notifications/preferences/:eventType
// @access  Private
const updatePreference = asyncHandler(async (req, res) => {
  requireWorkspace(req);

  const { eventType } = req.params;
  const { isEnabled } = req.body;

  if (!EVENT_TYPE_VALUES.has(eventType)) {
    throw new ApiError(400, `Unknown event type: ${eventType}`);
  }
  if (typeof isEnabled !== "boolean") {
    throw new ApiError(400, "isEnabled must be a boolean");
  }

  const updated = await notificationPreferenceRepository.upsert(
    req.user.id,
    req.workspace.id,
    eventType,
    isEnabled
  );

  return sendSuccess(res, {
    message: "Preference updated",
    data: { eventType: updated.event_type, label: EVENT_LABELS[eventType] || eventType, isEnabled: updated.is_enabled },
  });
});

module.exports = { getPreferences, updatePreference };
