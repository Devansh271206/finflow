/**
 * Audit Log Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `audit_logs`. Write-only this sprint — record() is the only
 * function exported. A list()/read endpoint is deliberately not built
 * yet; PRD §13.3 only requires that salary_history reads ARE logged,
 * not that there's a UI to view the log yet. Add list() when an Audit
 * Logs module is actually scoped (flagged in the Sprint 2 plan).
 *
 * Table: audit_logs
 * Columns: id, workspace_id, actor_user_id, action, resource_type,
 *          resource_id, metadata, created_at
 */

const { supabaseAdmin } = require("../config/supabase");

/**
 * Records one audit log entry. Deliberately does not throw on its own
 * for anything other than a genuine database error — logging failure
 * should not be allowed to silently swallow the caller's real request,
 * but it also should not be allowed to block it (see
 * salaryHistoryService.js's use of this — read succeeds even if
 * logging the read fails, with the failure itself logged to console).
 */
async function record({ workspaceId, actorUserId, action, resourceType, resourceId, metadata }) {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      workspace_id: workspaceId,
      actor_user_id: actorUserId,
      action,
      resource_type: resourceType,
      resource_id: resourceId || null,
      metadata: metadata || {},
    })
    .select("id, created_at")
    .single();

  if (error) throw error;
  return data;
}

module.exports = { record };
