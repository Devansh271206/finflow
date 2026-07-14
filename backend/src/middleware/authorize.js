/**
 * authorize Middleware
 * ------------------------------------------------------------------
 * Final step of the chain: authenticate() -> resolveWorkspace() -> authorize().
 * Checks whether req.membership's role has the given permission key.
 *
 * Usage:
 *   router.post("/", authorize(PERMISSIONS.TRANSACTIONS_CREATE), createTransaction);
 *
 * Phase 1 rollout mode:
 *   New Company/Workspace/Role endpoints use authorize() in enforcing mode
 *   (default) — a denial returns 403.
 *
 *   Existing single-tenant routes (transactions/budgets/categories/goals/
 *   dashboard/analytics/notifications) are NOT enforcing yet, per the
 *   Phase 1 scope (no behavior change to existing APIs). Where a route
 *   opts into authorize() early, pass `{ enforce: false }` to log-only:
 *   denials are recorded but the request proceeds. This lets Phase 2 flip
 *   enforcement on without another migration or route rewrite.
 */

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const permissionService = require("../services/permissionService");

function authorize(permissionKey, options = {}) {
  const { enforce = true } = options;

  return asyncHandler(async (req, res, next) => {
    // No membership resolved (legacy caller pre-migration, or no
    // workspace yet) — Phase 1 lets this through so existing behavior
    // is unaffected; the controller's own user_id filtering remains the
    // operative access control for those callers.
    if (!req.membership) {
      return next();
    }

    const allowed = await permissionService.hasPermission(
      req.membership.roleId,
      permissionKey
    );

    if (!allowed) {
      if (!enforce) {
        // eslint-disable-next-line no-console
        console.warn(
          `[authorize:log-only] Denied (would-block): user=${req.user?.id} ` +
            `workspace=${req.workspace?.id} role=${req.membership.roleKey} ` +
            `permission=${permissionKey} route=${req.method} ${req.originalUrl}`
        );
        return next();
      }
      throw new ApiError(
        403,
        `You do not have permission to perform this action (${permissionKey}).`
      );
    }

    next();
  });
}

module.exports = { authorize };
