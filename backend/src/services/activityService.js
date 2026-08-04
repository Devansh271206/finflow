/**
 * Activity Service
 * ------------------------------------------------------------------
 * Sprint 14. Subscribes to eventBusService (wired in
 * registerSubscribers.js) and writes one `activity_feed` row per
 * event — unconditionally, unlike notificationService.js, since the
 * activity feed is organization-wide visibility, not a per-user
 * preference-gated inbox.
 *
 * Also calls auditLogRepository.record() alongside the activity_feed
 * insert, per the sprint brief's explicit "Reuse existing Audit Logs
 * wherever possible" instruction — see migration 019's header comment
 * for why these are two separate writes to two separate tables rather
 * than one shared table/view: audit_logs is the compliance-oriented
 * log (already used for things like salary_history reads that have no
 * business being in an org-wide activity timeline), activity_feed is
 * the org-visibility timeline this sprint adds. Both are written from
 * one event so they never drift out of sync with each other.
 *
 * Also provides listActivity() — the role-scoped read the upcoming
 * activityController.js calls, mirroring
 * calendarAggregationService.js's resolveLeaveScope() pattern from
 * Sprint 13: Admin/HR see everything, Managers (Department Lead) see
 * their department's activity, Employees see only their own.
 */

const activityRepository = require("../repositories/activityRepository");
const auditLogRepository = require("../repositories/auditLogRepository");
const employeeRepository = require("../repositories/employeeRepository");

/**
 * Event handler — registered against every EVENT_TYPES value in
 * registerSubscribers.js. Never throws (isolated further by
 * eventBusService.publish()'s Promise.allSettled, but defensive here
 * too, same posture as notificationService.handleEvent).
 */
async function handleEvent(eventType, payload = {}) {
  const {
    workspaceId,
    actorUserId = null,
    module: moduleFacet,
    title,
    resourceType = null,
    resourceId = null,
    metadata = {},
  } = payload;

  if (!workspaceId) {
    console.error(`[activityService] Event "${eventType}" published with no workspaceId — skipped.`);
    return;
  }

  const action = title || eventType;
  const module = moduleFacet || "Organization";

  try {
    await activityRepository.create({
      workspace_id: workspaceId,
      actor_user_id: actorUserId,
      action,
      module,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
    });
  } catch (err) {
    console.error(`[activityService] Failed to write activity_feed row for "${eventType}":`, err.message);
  }

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: eventType,
      resourceType,
      resourceId,
      metadata: { ...metadata, module, title: action },
    });
  } catch (err) {
    console.error(`[activityService] Failed to write audit_logs row for "${eventType}":`, err.message);
  }
}

/**
 * Resolves the actor_user_id allowlist for a Manager (Department
 * Lead)'s scope — every employee in their department. Returns null
 * for Admin/HR (meaning "no restriction"), and an array (possibly
 * empty) for Manager/Employee scopes, matching
 * activityRepository.listForWorkspace()'s `actorUserIds` contract.
 */
async function resolveActorScope({ workspaceId, userId, roleKey }) {
  const normalizedRole = String(roleKey || "").toUpperCase();
  const isAdminOrHR = ["ADMIN", "OWNER", "FOUNDER", "HR"].includes(normalizedRole);

  if (isAdminOrHR) return null; // no restriction

  if (normalizedRole === "DEPARTMENT_LEAD") {
    const requester = await employeeRepository.findByUserIdInWorkspace(userId, workspaceId);
    if (!requester?.department_id) return [userId]; // no department resolved — fall back to own-only
    const { rows: deptEmployees } = await employeeRepository.listByWorkspace(workspaceId, {
      departmentId: requester.department_id,
    });
    const userIds = (deptEmployees || []).map((e) => e.user_id).filter(Boolean);
    return userIds.length ? userIds : [userId];
  }

  // Employee (or unrecognized role) — own activity only.
  return [userId];
}

async function listActivity(workspaceId, { userId, roleKey, page, limit, search, module: moduleFilter } = {}) {
  const actorUserIds = await resolveActorScope({ workspaceId, userId, roleKey });

  return activityRepository.listForWorkspace(workspaceId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: search ? String(search).trim() : undefined,
    module: moduleFilter,
    actorUserIds,
  });
}

module.exports = {
  handleEvent,
  listActivity,
};
