/**
 * resolveWorkspace Middleware
 * ------------------------------------------------------------------
 * Sits between authenticate() and authorize() in the middleware chain:
 *
 *   authenticate() -> resolveWorkspace() -> authorize(resource, action) -> controller
 *
 * Reads the `X-Workspace-Id` header, verifies the authenticated user has
 * an active membership in that workspace (never trusts the header alone —
 * PRD §5.1), and attaches:
 *
 *   req.workspace   -> { id, company_id, name, slug, status, created_at }
 *   req.membership  -> { id, workspaceId, userId, departmentId, roleId, roleKey, roleName }
 *
 * Backward compatibility (Phase 1): if no X-Workspace-Id header is sent,
 * this does NOT reject the request. It falls back to the caller's first
 * active membership so existing frontend calls (which don't yet send the
 * header) keep working unchanged. If the user has no membership at all
 * (shouldn't happen post-backfill, but guards new signups mid-rollout),
 * req.workspace/req.membership are left null and downstream controllers
 * fall back to legacy user_id-only scoping.
 */

const asyncHandler = require("../utils/asyncHandler");
const membershipService = require("../services/membershipService");

const resolveWorkspace = asyncHandler(async (req, res, next) => {
  if (!req.user?.id) {
    // authenticate() should have already rejected this, but guard anyway.
    return next();
  }

  const requestedWorkspaceId = req.headers["x-workspace-id"] || null;

  const { workspace, membership } = await membershipService.resolveForRequest(
    req.user.id,
    requestedWorkspaceId
  );

  req.workspace = workspace || null;
  req.membership = membership || null;

  next();
});

module.exports = { resolveWorkspace };
