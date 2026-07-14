/**
 * Company Controller
 * ------------------------------------------------------------------
 * Table: companies
 * Columns: id, name, slug, logo, industry, currency, timezone, country,
 *          owner_user_id, created_at, updated_at
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const companyRepository = require("../repositories/companyRepository");
const workspaceRepository = require("../repositories/workspaceRepository");
const membershipRepository = require("../repositories/membershipRepository");
const roleRepository = require("../repositories/roleRepository");

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// @desc    List companies owned by the authenticated user
// @route   GET /api/companies
// @access  Private
const getCompanies = asyncHandler(async (req, res) => {
  const companies = await companyRepository.findByOwner(req.user.id);
  return sendSuccess(res, { message: "Companies fetched", data: companies });
});

// @desc    Get a single company by id
// @route   GET /api/companies/:id
// @access  Private (owner)
const getCompanyById = asyncHandler(async (req, res) => {
  const company = await companyRepository.findById(req.params.id);
  if (!company) throw new ApiError(404, "Company not found");
  if (company.owner_user_id !== req.user.id) {
    throw new ApiError(403, "You do not have access to this company");
  }
  return sendSuccess(res, { message: "Company fetched", data: company });
});

// @desc    Create a company. Auto-creates a default workspace and an
//          admin membership for the creator (PRD §5.1).
// @route   POST /api/companies
// @access  Private
const createCompany = asyncHandler(async (req, res) => {
  const { name, logo, industry, currency, timezone, country } = req.body;

  let slug = slugify(name);
  let attempt = 0;
  while (await companyRepository.findBySlug(slug)) {
    attempt += 1;
    slug = `${slugify(name)}-${attempt}`;
  }

  const company = await companyRepository.create({
    name,
    slug,
    logo: logo || null,
    industry: industry || null,
    currency: currency || "INR",
    timezone: timezone || "Asia/Kolkata",
    country: country || null,
    owner_user_id: req.user.id,
  });

  const workspace = await workspaceRepository.create({
    company_id: company.id,
    name: "Default",
    slug: "default",
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
    message: "Company created",
    data: { company, workspace },
  });
});

// @desc    Update a company
// @route   PATCH /api/companies/:id
// @access  Private (owner)
const updateCompany = asyncHandler(async (req, res) => {
  const existing = await companyRepository.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Company not found");
  if (existing.owner_user_id !== req.user.id) {
    throw new ApiError(403, "You do not have access to this company");
  }

  const { name, logo, industry, currency, timezone, country } = req.body;
  const updated = await companyRepository.update(req.params.id, {
    ...(name !== undefined && { name }),
    ...(logo !== undefined && { logo }),
    ...(industry !== undefined && { industry }),
    ...(currency !== undefined && { currency }),
    ...(timezone !== undefined && { timezone }),
    ...(country !== undefined && { country }),
  });

  return sendSuccess(res, { message: "Company updated", data: updated });
});

module.exports = { getCompanies, getCompanyById, createCompany, updateCompany };
