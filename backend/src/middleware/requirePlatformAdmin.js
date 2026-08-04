/**
 * requirePlatformAdmin Middleware
 * ------------------------------------------------------------------
 * Gates every /api/platform/* route. Runs AFTER protect() and
 * INSTEAD OF resolveWorkspace()/authorize() — a Platform Admin has no
 * workspace membership by definition (PRD: "Platform Admin is NOT an
 * employee of any organization"), so the existing
 * roles/permissions/role_permissions machinery (which is always
 * exercised through a workspace membership — see
 * membershipService.resolveForRequest) doesn't apply here at all.
 * Building a parallel "platform roles" table with its own grants
 * would be over-engineering a v1 that only needs one boolean — see
 * migration 016's header comment for the full reasoning.
 *
 * Correct middleware chain for platform routes:
 *   protect() -> requirePlatformAdmin() -> controller
 *
 * Deliberately NOT chained after resolveWorkspace(): resolveWorkspace
 * falls back to the caller's first workspace membership when no
 * X-Workspace-Id header is sent (Phase 1 backward-compat behavior).
 * A Platform Admin account should have zero memberships, so that
 * fallback would just no-op (req.workspace/req.membership stay null),
 * but running it is pointless work on every platform-admin request
 * and — more importantly — implies platform routes are workspace-
 * scoped, which they explicitly must never be (PRD: "Platform Admin
 * must NEVER participate in employee workflows"). Keeping the platform
 * route chain structurally separate from the company route chain is
 * the actual point, not just an optimization.
 */

const { supabaseAdmin } = require("../config/supabase");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const requirePlatformAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user?.id) {
    // protect() should have already rejected this — guard anyway,
    // same defensive pattern resolveWorkspace.js uses.
    throw new ApiError(401, "Not authorized. No token provided.");
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", req.user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data?.is_platform_admin) {
    throw new ApiError(403, "Platform administrator access required.");
  }

  // Explicit and intentionally minimal: unlike req.membership (which
  // carries workspaceId/roleId/departmentId for company-scoped
  // queries), platform routes have no scoping dimension to attach —
  // req.user.id is already sufficient for every platformAdminService
  // call. This flag just lets downstream code assert "we got here
  // through the platform chain" if it ever needs to.
  req.isPlatformAdmin = true;

  next();
});

module.exports = { requirePlatformAdmin };
