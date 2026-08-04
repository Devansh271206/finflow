/**
 * Team Service
 * ------------------------------------------------------------------
 * Sprint 8 — Team Management (PRD §15.20). Routes -> controllers ->
 * services -> repositories (PRD §14), same layering introduced for
 * Departments this sprint (departmentService.js).
 *
 * Owns the cross-entity business rules PRD §15.20 implies but that
 * don't belong in teamRepository.js:
 *   - A team's parent Department must exist in the same workspace.
 *   - Team name is unique within its parent Department (DB constraint
 *     backs this too, but the service returns a clean 409 instead of
 *     a raw Postgres unique-violation).
 *   - Team Lead must be an employee of the team's parent Department.
 *   - A team member must belong to the team's parent Department, and
 *     "an employee belongs to at most one team at a time" (PRD §15.20
 *     functional requirements) — adding a member to Team B implicitly
 *     removes them from Team A rather than erroring, since PRD frames
 *     this as a reassignment relationship, mirroring how
 *     employeeService.js already reassigns department_id on update
 *     rather than requiring an explicit "remove from old department"
 *     step first.
 *
 * Out of Sprint 8 scope (left as TODOs, per the sprint's DO NOT
 * IMPLEMENT list): team_budgets, team analytics, leave calendar,
 * dashboard integration, org-chart rendering.
 */

const ApiError = require("../utils/ApiError");
const teamRepository = require("../repositories/teamRepository");
const departmentRepository = require("../repositories/departmentRepository");
const employeeRepository = require("../repositories/employeeRepository");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");
const { resolveAdminHRUserIds } = require("./notificationRecipientHelpers");

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

async function assertDepartmentInWorkspace(departmentId, workspaceId) {
  const department = await departmentRepository.findByIdInWorkspace(departmentId, workspaceId);
  if (!department) {
    throw new ApiError(400, "Department not found in this workspace");
  }
  return department;
}

/**
 * List teams for a workspace with optional department scope, search,
 * status filter, sort, and pagination.
 */
async function listTeams(workspaceId, query = {}) {
  const { departmentId, search, status, sortBy, sortOrder, page, limit } = query;

  const options = {
    departmentId,
    search: search ? String(search).trim() : undefined,
    sortBy,
    sortOrder,
  };

  if (status === "active") options.activeOnly = true;
  // status === "inactive" is a display-side filter, same TODO noted in
  // departmentService.js — no repository-level "inactiveOnly" exists
  // because no caller has needed it yet.

  if (page !== undefined || limit !== undefined) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE)
    );
    options.page = parsedPage;
    options.limit = parsedLimit;
  }

  return teamRepository.listByWorkspace(workspaceId, options);
}

/**
 * Team Details: the team row plus its member roster in one call, so
 * the Team Details page doesn't need two round trips.
 */
async function getTeamWithMembers(id, workspaceId) {
  const team = await teamRepository.findByIdInWorkspace(id, workspaceId);
  if (!team) throw new ApiError(404, "Team not found");

  const members = await teamRepository.listMembers(id, workspaceId);
  return { ...team, members };
}

async function createTeam(workspaceId, { department_id, name, description }) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Team name is required");
  }
  if (!department_id) {
    throw new ApiError(400, "department_id is required");
  }

  await assertDepartmentInWorkspace(department_id, workspaceId);

  const existing = await teamRepository.findByNameInDepartment(department_id, trimmedName);
  if (existing) {
    throw new ApiError(409, "A team with this name already exists in this department");
  }

  const team = await teamRepository.create({
    workspace_id: workspaceId,
    department_id,
    name: trimmedName,
    description: description ? String(description).trim() : null,
    is_active: true,
  });

  resolveAdminHRUserIds(workspaceId)
    .then((recipientUserIds) => {
      eventBusService.publish(EVENT_TYPES.TEAM_CREATED, {
        workspaceId,
        actorUserId: null, // createTeam has no actorUserId param — see employeeService.js's identical note
        recipientUserIds,
        module: "Team",
        resourceType: "team",
        resourceId: team.id,
        title: `Team "${trimmedName}" was created`,
        actionUrl: `/teams?id=${team.id}`,
        metadata: { departmentId: department_id },
      });
    })
    .catch((err) => console.error("[teamService] Failed to resolve recipients for TEAM_CREATED event:", err.message));

  return team;
}

async function updateTeam(id, workspaceId, { name, description, is_active }) {
  const existing = await teamRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Team not found");

  const payload = {};

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new ApiError(400, "Team name cannot be empty");
    }
    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await teamRepository.findByNameInDepartment(
        existing.department_id,
        trimmedName,
        id
      );
      if (duplicate) {
        throw new ApiError(409, "A team with this name already exists in this department");
      }
    }
    payload.name = trimmedName;
  }

  if (description !== undefined) {
    payload.description = description ? String(description).trim() : null;
  }

  if (is_active !== undefined) {
    payload.is_active = Boolean(is_active);
  }

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  return teamRepository.update(id, payload);
}

/**
 * Assign or clear (employeeId = null/undefined) a team's lead.
 * Validates the employee exists in the same workspace and belongs to
 * the team's parent Department (a Team Lead should be part of the
 * department that team sits under, same spirit as
 * departmentService.js's assignHead check).
 */
async function assignLead(id, workspaceId, employeeId) {
  const team = await teamRepository.findByIdInWorkspace(id, workspaceId);
  if (!team) throw new ApiError(404, "Team not found");

  if (employeeId === null || employeeId === undefined) {
    return teamRepository.assignLead(id, null);
  }

  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) {
    throw new ApiError(404, "Employee not found in this workspace");
  }
  if (employee.department_id && employee.department_id !== team.department_id) {
    throw new ApiError(
      400,
      "This employee belongs to a different department and cannot lead this team"
    );
  }

  return teamRepository.assignLead(id, employeeId);
}

/**
 * Add an employee to a team. An employee belongs to at most one team
 * at a time (PRD §15.20) — since employees.team_id is a single column,
 * this is enforced by construction; assigning here simply overwrites
 * any prior team_id, which is the reassignment behavior, not an error.
 */
async function addMember(teamId, workspaceId, employeeId) {
  const team = await teamRepository.findByIdInWorkspace(teamId, workspaceId);
  if (!team) throw new ApiError(404, "Team not found");
  if (!team.is_active) {
    throw new ApiError(400, "Cannot add members to an inactive team");
  }

  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) {
    throw new ApiError(404, "Employee not found in this workspace");
  }
  if (employee.department_id && employee.department_id !== team.department_id) {
    throw new ApiError(
      400,
      "This employee belongs to a different department and cannot join this team"
    );
  }

  return employeeRepository.update(employeeId, { team_id: teamId });
}

/**
 * Remove an employee from a team. Only clears membership if the
 * employee is currently on THIS team — prevents a stale/duplicate
 * remove request from one team accidentally clearing membership an
 * employee has since moved to a different team.
 */
async function removeMember(teamId, workspaceId, employeeId) {
  const team = await teamRepository.findByIdInWorkspace(teamId, workspaceId);
  if (!team) throw new ApiError(404, "Team not found");

  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) {
    throw new ApiError(404, "Employee not found in this workspace");
  }
  if (employee.team_id !== teamId) {
    throw new ApiError(400, "This employee is not a member of this team");
  }

  return employeeRepository.update(employeeId, { team_id: null });
}

module.exports = {
  listTeams,
  getTeamWithMembers,
  createTeam,
  updateTeam,
  assignLead,
  addMember,
  removeMember,
};