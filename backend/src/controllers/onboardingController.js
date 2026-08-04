/**
 * Onboarding Controller
 * ------------------------------------------------------------------
 * Sprint 13, Part 1: Enterprise Organization Onboarding.
 *
 * Deliberately does NOT re-implement Step 2 (Administrator Account).
 * The existing POST /api/auth/register already does exactly what Step
 * 2 asks for (full name, work email, password -> Supabase user), and
 * every new signup already lands with an authenticated session
 * (authController.register returns data.session when email
 * confirmation isn't required). The frontend wizard therefore:
 *   1. Collects Steps 1+3 locally (no API calls yet — nothing to create
 *      until the admin account exists to own it).
 *   2. Calls POST /api/auth/register (existing, unchanged) for Step 2.
 *   3. Calls POST /api/onboarding/complete (this controller) with the
 *      Step 1 + Step 3 data, authenticated as the just-registered user,
 *      to run Step 4 (Workspace Initialization).
 *
 * This keeps auth as the single source of truth for account creation
 * (PRD's own layering) instead of onboarding duplicating it.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const onboardingService = require("../services/onboardingService");

// @desc    Complete onboarding: create Organization + Workspace +
//          Organization Admin Membership, then seed default ERP data
//          (departments, teams, leave types, categories).
// @route   POST /api/onboarding/complete
// @access  Private (any authenticated user — becomes the org's admin)
const completeOnboarding = asyncHandler(async (req, res) => {
  const {
    organization_name,
    industry,
    company_size,
    country,
    currency,
    time_zone,
    financial_year,
    // Step 3 fields are accepted and echoed back in the response today;
    // they're not yet persisted anywhere (see NEXT FILE plan — this
    // sprint's confirmed schema has no workspace columns for
    // working_days/office_hours/weekend_config/default leave & expense
    // policy yet, same gap calendarAggregationService.js already
    // flagged for weekend_config). Accepting-but-not-yet-persisting is
    // preferable to silently dropping them or inventing column names
    // that might not match a future migration.
    working_days,
    office_hours,
    weekend_config,
    default_leave_policy,
    default_expense_policy,
  } = req.body;

  if (!organization_name || !String(organization_name).trim()) {
    throw new ApiError(400, "organization_name is required");
  }

  const summary = await onboardingService.completeOnboarding({
    orgInfo: {
      name: organization_name,
      industry,
      companySize: company_size,
      country,
      currency,
      timeZone: time_zone,
      financialYear: financial_year,
    },
    userId: req.user.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Onboarding completed",
    data: {
      ...summary,
      organizationSetup: {
        working_days: working_days || null,
        office_hours: office_hours || null,
        weekend_config: weekend_config || null,
        default_leave_policy: default_leave_policy || null,
        default_expense_policy: default_expense_policy || null,
        persisted: false,
      },
    },
  });
});

module.exports = { completeOnboarding };
