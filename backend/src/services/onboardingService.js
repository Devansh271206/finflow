/**
 * Onboarding Service
 * ------------------------------------------------------------------
 * Sprint 13, Part 1: Enterprise Organization Onboarding. Orchestrates
 * the wizard's Step 4 ("Workspace Initialization") into one call:
 * creates the Organization (company) + Workspace + Organization Admin
 * Membership, then seeds default ERP data.
 *
 * Deliberately reuses existing creation logic rather than duplicating
 * it:
 *   - Company + Workspace + Admin Membership creation is the exact
 *     sequence companyController.createCompany already performs
 *     (slugify -> create company -> create workspace -> assign admin
 *     role). That logic is lifted into this service so both the
 *     existing POST /api/companies route AND the new onboarding route
 *     share one implementation — companyController.js is updated
 *     (see NEXT FILE plan) to call this service instead of duplicating
 *     the sequence a second time.
 *   - Default categories: categoryService.seedDefaultsForWorkspace()
 *     (already exists, already idempotent — used unchanged).
 *   - Default departments/teams/leave types: these modules have no
 *     existing seed-defaults function (confirmed: only categoryService
 *     exports one), so this service seeds them directly via each
 *     module's own createX() service function, one row at a time, so
 *     validation/audit-logging for each still goes through the normal
 *     path rather than a raw repository insert.
 *
 * Default Budget Categories (PRD onboarding Step 4 list): this
 * codebase's budgets reference `category_id` (see budgetService.js),
 * and categoryService.seedDefaultsForWorkspace() already seeds the
 * enterprise category set budgets draw from — there is no separate
 * "budget category" table distinct from `categories`. Rather than
 * inventing a parallel concept, default budget categories are
 * satisfied by the same category-seeding call; no separate budget rows
 * are created here since budgets also require an amount/period the
 * wizard doesn't collect (PRD Step 3 only collects policy defaults, not
 * concrete budget figures).
 *
 * Default Dashboard Preferences: no dashboard_preferences table/service
 * was found in this codebase (dashboardService.js computes dashboard
 * data on read, it doesn't store preferences). Rather than inventing a
 * new table not requested by the SDD, this is satisfied by simply
 * ensuring the admin's role (Admin) resolves to a dashboard variant
 * that already exists (roleDashboardService.js already branches by
 * role) — flagged here rather than silently skipped, in case a real
 * dashboard_preferences table is introduced in a later sprint.
 *
 * Non-fatal seeding: every seed step is wrapped in try/catch (same
 * posture workspaceController.createWorkspace already uses for
 * category seeding) — a seeding failure must never roll back or block
 * the org/workspace/admin creation that already succeeded, since the
 * admin can always add departments/leave types manually afterward.
 */

const ApiError = require("../utils/ApiError");
const companyRepository = require("../repositories/companyRepository");
const workspaceRepository = require("../repositories/workspaceRepository");
const membershipRepository = require("../repositories/membershipRepository");
const roleRepository = require("../repositories/roleRepository");
const categoryService = require("./categoryService");
const departmentService = require("./departmentService");
const teamService = require("./teamService");
const leaveTypeService = require("./leaveTypeService");

const DEFAULT_DEPARTMENTS = ["Engineering", "Human Resources", "Finance", "Operations"];
const DEFAULT_LEAVE_TYPES = [
  { name: "Paid Leave", is_paid: true, default_annual_days: 18 },
  { name: "Sick Leave", is_paid: true, default_annual_days: 10 },
  { name: "Unpaid Leave", is_paid: false, default_annual_days: 0 },
];

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Step 4 core: Organization + Workspace + Admin Membership. Lifted
 * verbatim from companyController.createCompany's existing sequence so
 * behavior is identical to creating a company through the pre-existing
 * flow — this is not a new way of creating a company, just the same
 * one made callable from onboardingService.
 */
async function createOrganizationWorkspaceAndAdmin({ orgInfo, userId }) {
  const { name, industry, country, currency, timeZone } = orgInfo;

  if (!name || !String(name).trim()) {
    throw new ApiError(400, "Organization name is required");
  }

  let slug = slugify(name);
  let attempt = 0;
  while (await companyRepository.findBySlug(slug)) {
    attempt += 1;
    slug = `${slugify(name)}-${attempt}`;
  }

  const company = await companyRepository.create({
    name,
    slug,
    industry: industry || null,
    currency: currency || "INR",
    timezone: timeZone || "Asia/Kolkata",
    country: country || null,
    owner_user_id: userId,
  });

  const workspace = await workspaceRepository.create({
    company_id: company.id,
    name: "Default",
    slug: "default",
    status: "active",
  });

  const adminRole = await roleRepository.findRoleByKey("admin");
  if (!adminRole) {
    throw new ApiError(500, "Admin role is not seeded — cannot complete onboarding");
  }

  await membershipRepository.create({
    workspace_id: workspace.id,
    user_id: userId,
    role_id: adminRole.id,
    status: "active",
  });

  return { company, workspace };
}

/**
 * Seeds default departments, returning the created rows so
 * seedDefaultTeams() can attach a default team to the first one.
 * Each failure is logged and skipped individually rather than aborting
 * the whole batch — one bad row shouldn't block the other three.
 */
async function seedDefaultDepartments(workspaceId, actorUserId) {
  const created = [];
  for (const name of DEFAULT_DEPARTMENTS) {
    try {
      const department = await departmentService.createDepartment(workspaceId, { name }, actorUserId);
      created.push(department);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[onboardingService] Failed to seed department "${name}":`, err.message);
    }
  }
  return created;
}

/**
 * Seeds one default "General" team per created department, so new
 * workspaces aren't left with departments but zero team structure.
 */
async function seedDefaultTeams(workspaceId, departments) {
  for (const department of departments) {
    try {
      await teamService.createTeam(workspaceId, {
        department_id: department.id,
        name: "General",
        description: `Default team for ${department.name}`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[onboardingService] Failed to seed default team for department "${department.name}":`,
        err.message
      );
    }
  }
}

async function seedDefaultLeaveTypes(workspaceId, actorUserId) {
  for (const leaveType of DEFAULT_LEAVE_TYPES) {
    try {
      await leaveTypeService.createLeaveType(workspaceId, leaveType, actorUserId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[onboardingService] Failed to seed leave type "${leaveType.name}":`,
        err.message
      );
    }
  }
}

/**
 * Full Step 4 orchestration: create org/workspace/admin, then seed
 * every default listed in the sprint brief that has a real backing
 * module to seed into. Returns a summary the WorkspaceInitStep UI can
 * render as a checklist.
 */
async function completeOnboarding({ orgInfo, userId }) {
  const { company, workspace } = await createOrganizationWorkspaceAndAdmin({ orgInfo, userId });

  const summary = {
    company,
    workspace,
    departments: [],
    teamsSeeded: false,
    leaveTypesSeeded: false,
    categoriesSeeded: false,
  };

  try {
    summary.departments = await seedDefaultDepartments(workspace.id, userId);
  } catch (err) {
    console.error("[onboardingService] Department seeding step failed:", err.message);
  }

  if (summary.departments.length) {
    try {
      await seedDefaultTeams(workspace.id, summary.departments);
      summary.teamsSeeded = true;
    } catch (err) {
      console.error("[onboardingService] Team seeding step failed:", err.message);
    }
  }

  try {
    await seedDefaultLeaveTypes(workspace.id, userId);
    summary.leaveTypesSeeded = true;
  } catch (err) {
    console.error("[onboardingService] Leave type seeding step failed:", err.message);
  }

  try {
    await categoryService.seedDefaultsForWorkspace(workspace.id, userId);
    summary.categoriesSeeded = true;
  } catch (err) {
    console.error("[onboardingService] Category seeding step failed:", err.message);
  }

  return summary;
}

module.exports = {
  createOrganizationWorkspaceAndAdmin,
  completeOnboarding,
};
