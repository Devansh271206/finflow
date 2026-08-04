/**
 * Event Types
 * ------------------------------------------------------------------
 * Sprint 14: Enterprise Notification Center & Activity Feed.
 *
 * Single source of truth for the 17 event names every existing module
 * publishes via eventBusService.emit() instead of creating
 * notifications/activity rows directly (per the sprint brief's core
 * instruction: "Existing modules should publish events instead of
 * directly creating notifications").
 *
 * Values are intentionally identical to the `type` values the
 * notifications_type_check CHECK constraint (migration 019) accepts —
 * notificationService.js uses EVENT_TYPES values directly as the
 * notification row's `type` column, so there is exactly one place
 * either needs updating if a type is ever renamed.
 *
 * Every publisher call looks like:
 *   eventBusService.emit(EVENT_TYPES.LEAVE_APPROVED, {
 *     workspaceId, actorUserId, resourceType: 'leave_request',
 *     resourceId: leaveRequest.id, recipientUserIds: [employee.user_id],
 *     module: 'Leave', title: '...', message: '...', actionUrl: '...',
 *   });
 *
 * Payload contract (documented once here, not per-event, since every
 * event shares the same shape — subscribers only vary in which fields
 * they actually use):
 *   {
 *     workspaceId: string (required — workspace isolation, per
 *       resource_type: string | null (e.g. 'leave_request', 'employee')
 *       resource_id/table this event is about, mirrors
 *       notifications.resource_type/activity_feed.resource_type),
 *     resourceId: string | null (matches resource_type's row id),
 *     actorUserId: string | null (who triggered this — the submitter/
 *       approver/admin; null for system-generated events with no human
 *       actor, e.g. a scheduled budget-exceeded check),
 *     recipientUserIds: string[] (who should receive an in-app
 *       notification — notificationService.js creates one row per
 *       recipient; activityService.js ignores this field entirely,
 *       since activity feed is workspace-wide, not per-recipient),
 *     module: string (facet for activity_feed.module — 'Leave',
 *       'Expense', 'Payroll', 'Employee', 'Department', 'Team',
 *       'Vendor', 'Budget', 'Organization', 'Holiday', 'Reports'),
 *     title: string (notification title / activity feed action summary),
 *     message: string | null (notification body detail),
 *     actionUrl: string | null (frontend deep link),
 *     metadata: object (anything else worth keeping — e.g. amount,
 *       department name — stored as-is in both notifications and
 *       activity_feed's metadata jsonb columns),
 *   }
 *
 * All fields except workspaceId are optional at the type level;
 * eventBusService.js does not validate shape (kept a thin dispatcher,
 * not a schema enforcer) — notificationService.js/activityService.js
 * are responsible for defensively handling missing fields, same
 * "non-fatal, never block the caller" posture as auditLogRepository.js.
 */

const EVENT_TYPES = Object.freeze({
  LEAVE_SUBMITTED: "leave_submitted",
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",

  EXPENSE_SUBMITTED: "expense_submitted",
  EXPENSE_APPROVED: "expense_approved",
  EXPENSE_REJECTED: "expense_rejected",

  PAYROLL_GENERATED: "payroll_generated",

  EMPLOYEE_CREATED: "employee_created",
  EMPLOYEE_UPDATED: "employee_updated",

  DEPARTMENT_CREATED: "department_created",
  TEAM_CREATED: "team_created",

  VENDOR_ADDED: "vendor_added",

  BUDGET_EXCEEDED: "budget_exceeded",
  BUDGET_UPDATED: "budget_updated",

  ORGANIZATION_ANNOUNCEMENT: "organization_announcement",

  HOLIDAY_ADDED: "holiday_added",

  REPORT_GENERATED: "report_generated",
});

// Reverse-lookup set for cheap "is this a known event type" checks
// (e.g. notificationPreferenceService.js validating a preference
// update's event_type against real events rather than any string).
const EVENT_TYPE_VALUES = new Set(Object.values(EVENT_TYPES));

module.exports = { EVENT_TYPES, EVENT_TYPE_VALUES };
