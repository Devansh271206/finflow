/**
 * Team Controller
 * ------------------------------------------------------------------
 * Table: teams (see teamRepository.js for full column list)
 *
 * Route protection (see teamRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.TEAMS_*)
 *
 * PRD §15.20 RBAC:
 *   - Organization Admin: full team CRUD across the organization
 *   - Department Lead: create/edit teams within own department
 *   - Team Lead: (approval-authority scope, not a CRUD scope — out of
 *     Sprint 8, no Approval Engine work here per DO NOT IMPLEMENT)
 *   - Employee: read-only view of own team
 *   Sprint 8 implements this as TEAMS_READ (broad) / TEAMS_MANAGE
 *   (Admin + Dept Lead) at the permission-registry level, same
 *   granularity departments.read/departments.manage already use —
 *   finer-grained "own department only" scoping for Dept Lead is
 *   enforced the same way employeeController.js already scopes
 *   Department Leads (req.membership.departmentId), applied below.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const teamService = require("../services/teamService");

// @desc    List teams in the resolved workspace, optionally scoped to
//          a department (Team Directory / nested under Department Details)
// @route   GET /api/teams?department_id=&search=&status=&sort_by=&sort_order=&page=&page_size=
// @access  Member (teams.read)
const getTeams = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  let { department_id, search, status, sort_by, sort_order, page, page_size } = req.query;

  // Department Lead scope restriction — same pattern as
  // employeeController.js's getEmployees.
  if (req.membership && req.membership.roleKey === "DEPARTMENT_LEAD") {
    department_id = req.membership.departmentId;
  }

  const result = await teamService.listTeams(req.workspace.id, {
    departmentId: department_id,
    search,
    status,
    sortBy: sort_by,
    sortOrder: sort_order,
    page,
    limit: page_size,
  });

  const data = Array.isArray(result)
    ? result
    : { items: result.data, total: result.total, page: result.page, pageSize: result.limit };

  return sendSuccess(res, { message: "Teams fetched", data });
});

// @desc    Get a single team (with its member roster) — Team Details page
// @route   GET /api/teams/:id
// @access  Member (teams.read)
const getTeamById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const team = await teamService.getTeamWithMembers(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Team fetched", data: team });
});

// @desc    Create a team under a department
// @route   POST /api/teams
// @access  Admin / Dept Lead (teams.manage)
const createTeam = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const team = await teamService.createTeam(req.workspace.id, {
    department_id: req.body.department_id,
    name: req.body.name,
    description: req.body.description,
  });

  return sendSuccess(res, { statusCode: 201, message: "Team created", data: team });
});

// @desc    Rename/redescribe and/or activate/deactivate a team.
//          Soft-delete only — no hard-delete path (same convention as
//          departments).
// @route   PATCH /api/teams/:id
// @access  Admin / Dept Lead (teams.manage)
const updateTeam = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await teamService.updateTeam(req.params.id, req.workspace.id, {
    name: req.body.name,
    description: req.body.description,
    is_active: req.body.is_active,
  });

  return sendSuccess(res, { message: "Team updated", data: updated });
});

// @desc    Assign (or clear, with employee_id: null) the Team Lead
// @route   PATCH /api/teams/:id/lead
// @access  Admin / Dept Lead (teams.manage)
const assignTeamLead = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await teamService.assignLead(
    req.params.id,
    req.workspace.id,
    req.body.employee_id
  );

  return sendSuccess(res, { message: "Team lead updated", data: updated });
});

// @desc    Add an employee to a team
// @route   POST /api/teams/:id/members
// @access  Admin / Dept Lead (teams.manage)
const addTeamMember = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const employee = await teamService.addMember(
    req.params.id,
    req.workspace.id,
    req.body.employee_id
  );

  return sendSuccess(res, { statusCode: 201, message: "Team member added", data: employee });
});

// @desc    Remove an employee from a team
// @route   DELETE /api/teams/:id/members/:employeeId
// @access  Admin / Dept Lead (teams.manage)
const removeTeamMember = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const employee = await teamService.removeMember(
    req.params.id,
    req.workspace.id,
    req.params.employeeId
  );

  return sendSuccess(res, { message: "Team member removed", data: employee });
});

module.exports = {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  assignTeamLead,
  addTeamMember,
  removeTeamMember,
};