/**
 * Workspace Scope Helper
 * ------------------------------------------------------------------
 * Phase 1 dual-scoping utility. Existing controllers already filter every
 * query by `user_id` (single-tenant isolation). This helper adds an
 * ADDITIONAL `workspace_id` filter on top when a workspace has been
 * resolved (req.workspace set by resolveWorkspace middleware) — it never
 * replaces the user_id filter, so:
 *
 *   - Legacy callers with no X-Workspace-Id header: behavior unchanged
 *     (req.workspace is the user's first membership's workspace, and every
 *     existing row already belongs to that workspace post-backfill, so the
 *     added filter is a no-op in practice).
 *   - New callers with X-Workspace-Id: get the same result, now also
 *     verified against the tenant boundary.
 *
 * Usage:
 *   let query = supabaseAdmin.from("transactions").select(...).eq("user_id", userId);
 *   query = applyWorkspaceScope(query, req);
 *
 * For inserts, use workspaceIdForInsert(req) to stamp the new row.
 */

function applyWorkspaceScope(query, req) {
  if (req.workspace?.id) {
    return query.eq("workspace_id", req.workspace.id);
  }
  return query;
}

function workspaceIdForInsert(req) {
  return req.workspace?.id || null;
}

module.exports = { applyWorkspaceScope, workspaceIdForInsert };
