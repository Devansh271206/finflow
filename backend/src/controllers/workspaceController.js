/**
 * Workspace Controller
 * ------------------------------------------------------------------
 * Table: workspaces
 * Columns: id, company_id, name, slug, status, created_at
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const workspaceRepository = require("../repositories/workspaceRepository");
const companyRepository = require("../repositories/companyRepository");
const membershipRepository = require("../repositories/membershipRepository");
const roleRepository = require("../repositories/roleRepository");

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// @desc    List every workspace the authenticated user belongs to
//          (used by the frontend workspace switcher)
// @route   GET /api/workspaces
// @access  Private
const getWorkspaces = asyncHandler(async (req, res) => {
  const memberships = await workspaceRepository.findByUser(req.user.id);
  return sendSuccess(res, { message: "Workspaces fetched", data: memberships });
});

// @desc    Create a new workspace under an existing company. A company
//          can own multiple workspaces (PRD §5.1, e.g. Production/Sandbox).
// @route   POST /api/workspaces
// @access  Private (must own the parent company)
const createWorkspace = asyncHandler(async (req, res) => {
  const { company_id, name } = req.body;
  if (!company_id || !name) {
    throw new ApiError(400, "company_id and name are required");
  }

  const company = await companyRepository.findById(company_id);
  if (!company) throw new ApiError(404, "Company not found");
  if (company.owner_user_id !== req.user.id) {
    throw new ApiError(403, "You do not have access to this company");
  }

  let slug = slugify(name);
  let attempt = 0;
  while (await workspaceRepository.slugExistsInCompany(company_id, slug)) {
    attempt += 1;
    slug = `${slugify(name)}-${attempt}`;
  }

  const workspace = await workspaceRepository.create({
    company_id,
    name,
    slug,
    status: "active",
  });

  const adminRole = await roleRepository.findRoleByKey("admin");
  await membershipRepository.create({
    workspace_id: workspace.id,
    user_id: req.user.id,
    role_id: adminRole.id,
    status: "active",
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Workspace created",
    data: workspace,
  });
});

// @desc    Get a single workspace's settings
// @route   GET /api/workspaces/:id
// @access  Member
const getWorkspaceById = asyncHandler(async (req, res) => {
  const membership = await membershipRepository.findActiveMembership(
    req.user.id,
    req.params.id
  );
  if (!membership) {
    throw new ApiError(403, "You do not have access to this workspace");
  }

  const workspace = await workspaceRepository.findById(req.params.id);
  if (!workspace) throw new ApiError(404, "Workspace not found");

  return sendSuccess(res, { message: "Workspace fetched", data: workspace });
});

// @desc    Update workspace settings
// @route   PATCH /api/workspaces/:id
// @access  Admin (enforced via authorize(WORKSPACE_UPDATE) on the route)
const updateWorkspace = asyncHandler(async (req, res) => {
  const { name, status } = req.body;
  const updated = await workspaceRepository.update(req.params.id, {
    ...(name !== undefined && { name }),
    ...(status !== undefined && { status }),
  });
  if (!updated) throw new ApiError(404, "Workspace not found");

  return sendSuccess(res, { message: "Workspace updated", data: updated });
});

module.exports = { getWorkspaces, createWorkspace, getWorkspaceById, updateWorkspace };
