/**
 * Membership Service
 * ------------------------------------------------------------------
 * Business logic for resolving which workspace a request applies to and
 * the caller's membership within it. Used by the resolveWorkspace
 * middleware — kept framework-agnostic per PRD §10.1 layering.
 */

const membershipRepository = require("../repositories/membershipRepository");
const workspaceRepository = require("../repositories/workspaceRepository");
const ApiError = require("../utils/ApiError");

/**
 * Resolves the effective workspace + membership for a request.
 *
 * - If `requestedWorkspaceId` is provided (from X-Workspace-Id), the user's
 *   membership in that exact workspace is verified — never trust the header
 *   without checking `memberships` server-side (PRD §5.1).
 * - If not provided, falls back to the user's first active membership, so
 *   Phase 1 existing routes keep working for callers who haven't been
 *   updated to send the header yet (backward compatibility, per instructions).
 * - If the user has no active membership anywhere, returns nulls — callers
 *   decide whether that's fatal (new endpoints) or tolerated (legacy routes
 *   during the transition window).
 */
async function resolveForRequest(userId, requestedWorkspaceId) {
  if (requestedWorkspaceId) {
    const membership = await membershipRepository.findActiveMembership(
      userId,
      requestedWorkspaceId
    );
    if (!membership) {
      throw new ApiError(
        403,
        "You do not have access to the requested workspace."
      );
    }
    const workspace = await workspaceRepository.findById(requestedWorkspaceId);
    return { workspace, membership };
  }

  const fallbackWorkspaceId = await membershipRepository.findFirstActiveMembership(
    userId
  );
  if (!fallbackWorkspaceId) {
    return { workspace: null, membership: null };
  }

  const membership = await membershipRepository.findActiveMembership(
    userId,
    fallbackWorkspaceId
  );
  const workspace = await workspaceRepository.findById(fallbackWorkspaceId);
  return { workspace, membership };
}

module.exports = { resolveForRequest };
