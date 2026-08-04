/**
 * Notification Recipient Helpers
 * ------------------------------------------------------------------
 * Sprint 14. Extracted after the same "list active workspace members
 * with role key in {ADMIN, OWNER, FOUNDER, HR, ...}" filter was
 * written inline, near-identically, in leaveRequestService.js,
 * employeeService.js, and departmentService.js. Rather than repeat it
 * a fourth time in teamService.js, it's centralized here.
 *
 * NOT a repository (no direct Supabase calls) and NOT a full service
 * (no business logic beyond "which members match this role set") —
 * a small shared utility every module's event-publish code can import
 * directly, avoiding a circular dependency on notificationService.js
 * itself (which has no reason to know about roles/departments at all).
 *
 * Existing inline versions in leaveRequestService.js/employeeService.js/
 * departmentService.js are NOT retroactively refactored to use this
 * file in this same change — each of those files is otherwise
 * untouched and working; swapping their internals to call this helper
 * is a pure refactor with no behavior change, better done as its own
 * reviewed diff rather than silently bundled into an unrelated file's
 * turn. Flagging here so it's visible, not hidden.
 */

const membershipRepository = require("../repositories/membershipRepository");

const ADMIN_HR_ROLE_KEYS = new Set(["ADMIN", "OWNER", "FOUNDER", "HR"]);

/**
 * Every active member whose role is Admin/Owner/Founder/HR — the
 * "org-wide visibility" recipient set used by module-level events
 * (Department Created, Team Created, Employee Created/Updated,
 * Vendor Added, Budget Updated, Holiday Added, Report Generated) where
 * there's no more specific recipient (e.g. no single "owner" of a
 * department the way a leave request has a requesting employee).
 */
async function resolveAdminHRUserIds(workspaceId) {
  const members = await membershipRepository.listByWorkspace(workspaceId);
  return (members || [])
    .filter((m) => m.status === "active" && ADMIN_HR_ROLE_KEYS.has(String(m.roles?.key || "").toUpperCase()))
    .map((m) => m.user_id)
    .filter(Boolean);
}

module.exports = { resolveAdminHRUserIds, ADMIN_HR_ROLE_KEYS };
