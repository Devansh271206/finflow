/**
 * Membership Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for `memberships`.
 * This is the table resolveWorkspace() and authorize() depend on.
 */

const { supabaseAdmin } = require("../config/supabase");

/**
 * Resolve a user's active membership in a specific workspace, including
 * the role key and its permission set — everything resolveWorkspace()
 * needs to populate req.membership in one query.
 */
async function findActiveMembership(userId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select(
      `
      id, workspace_id, user_id, department_id, status, joined_at,
      role_id,
      roles:role_id ( id, key, name )
      `
    )
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    userId: data.user_id,
    departmentId: data.department_id,
    status: data.status,
    roleId: data.role_id,
    roleKey: data.roles?.key,
    roleName: data.roles?.name,
  };
}

async function findFirstActiveMembership(userId) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.workspace_id || null;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function listByWorkspace(workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select(
      `
      id, user_id, department_id, status, joined_at,
      roles:role_id ( id, key, name )
      `
    )
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return data;
}

module.exports = {
  findActiveMembership,
  findFirstActiveMembership,
  create,
  listByWorkspace,
};
