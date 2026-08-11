/**
 * Invitation Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for the
 * `invitations` table (migration 021). Backs the workspace
 * join-by-invitation flow.
 */

const { supabaseAdmin } = require("../config/supabase");

// Returns invitation rows enriched with the workspace/company/role the
// invitee is being invited into, so both the public join page and the
// accept flow can render useful context without extra queries.
const INVITE_DETAIL_SELECT = `
  id, workspace_id, email, role_id, department_id, invited_by,
  token, status, sent_at, expires_at, accepted_at, created_at,
  workspaces:workspace_id (
    id, company_id, name, slug, status,
    companies:company_id ( id, name )
  ),
  roles:role_id ( id, key, name )
`;

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("invitations")
    .insert(payload)
    .select(INVITE_DETAIL_SELECT)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Look up an invitation by its secret token. Token is UNIQUE, so this
 * is safe against multiple rows. Used by the (public) join-link check
 * and by accept validation.
 */
async function findByToken(token) {
  const { data, error } = await supabaseAdmin
    .from("invitations")
    .select(INVITE_DETAIL_SELECT)
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Find the still-usable invitation for a given workspace + email, if any.
 * Used so a re-invite resends the same token rather than stacking
 * multiple pending invitations.
 */
async function findPendingByWorkspaceAndEmail(workspaceId, email) {
  const { data, error } = await supabaseAdmin
    .from("invitations")
    .select(INVITE_DETAIL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("email", email.trim().toLowerCase())
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("invitations")
    .update(payload)
    .eq("id", id)
    .select(INVITE_DETAIL_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listByWorkspace(workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("invitations")
    .select(INVITE_DETAIL_SELECT)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

module.exports = {
  create,
  findByToken,
  findPendingByWorkspaceAndEmail,
  update,
  listByWorkspace,
};
