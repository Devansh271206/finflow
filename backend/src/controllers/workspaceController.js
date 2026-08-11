/**
 * Workspace Controller
 * ------------------------------------------------------------------
 * Table: workspaces
 * Columns: id, company_id, name, slug, status, created_at
 *
 * Phase 2.2.1: createWorkspace now seeds the default system category set
 * (see categoryService.seedDefaultsForWorkspace) right after the new
 * admin membership is created, so every workspace starts with its
 * enterprise categories already in place — no manual step needed.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const workspaceRepository = require("../repositories/workspaceRepository");
const companyRepository = require("../repositories/companyRepository");
const membershipRepository = require("../repositories/membershipRepository");
const roleRepository = require("../repositories/roleRepository");
const categoryService = require("../services/categoryService");

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

// @desc    Create a new workspace. A workspace belongs to a company
//          (PRD §5.1). If the caller passes an owned company_id, the
//          workspace is created under it. If company_id is omitted, the
//          caller's company is used when they own exactly one; otherwise
//          a company is auto-created for the caller so any user can
//          bootstrap their own workspace without a separate "create
//          company" step.
// @route   POST /api/workspaces
// @access  Private
const createWorkspace = asyncHandler(async (req, res) => {
  const { company_id, name } = req.body;
  if (!name) {
    throw new ApiError(400, "name is required");
  }

  let company = null;

  if (company_id) {
    company = await companyRepository.findById(company_id);
    if (!company) throw new ApiError(404, "Company not found");
    if (company.owner_user_id !== req.user.id) {
      throw new ApiError(403, "You do not have access to this company");
    }
  } else {
    // Pick the caller's sole company, else auto-create one for them.
    const owned = await companyRepository.findByOwner(req.user.id);
    if (owned.length === 1) {
      company = owned[0];
    } else {
      let companySlug = slugify(name);
      let companyAttempt = 0;
      while (await companyRepository.findBySlug(companySlug)) {
        companyAttempt += 1;
        companySlug = `${slugify(name)}-${companyAttempt}`;
      }
      company = await companyRepository.create({
        name,
        slug: companySlug,
        currency: "INR",
        timezone: "Asia/Kolkata",
        owner_user_id: req.user.id,
      });
    }
  }

  let slug = slugify(name);
  let attempt = 0;
  while (await workspaceRepository.slugExistsInCompany(company.id, slug)) {
    attempt += 1;
    slug = `${slugify(name)}-${attempt}`;
  }

  const workspace = await workspaceRepository.create({
    company_id: company.id,
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

  // Seed the default enterprise category set (Cloud Infrastructure,
  // Payroll, Engineering, ...) so the workspace isn't empty on first use.
  // Non-fatal: if seeding fails for some reason, the workspace itself is
  // still created successfully — categories can always be added manually,
  // and re-running the seed later is idempotent (see categoryService).
  try {
    await categoryService.seedDefaultsForWorkspace(workspace.id, req.user.id);
  } catch (seedError) {
    // eslint-disable-next-line no-console
    console.error(
      `[createWorkspace] Failed to seed default categories for workspace ${workspace.id}:`,
      seedError.message
    );
  }

  return sendSuccess(res, {
    statusCode: 201,
    message: "Workspace created",
    data: { ...workspace, company_id: company.id, company: { id: company.id, name: company.name } },
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