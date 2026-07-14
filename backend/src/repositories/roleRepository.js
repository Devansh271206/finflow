/**
 * Role Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `roles`, `permissions`, and `role_permissions`.
 */

const { supabaseAdmin } = require("../config/supabase");

async function listRoles() {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id, key, name, is_system, created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

async function findRoleByKey(key) {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id, key, name")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Returns the flat set of permission keys granted to a role, e.g.
 * ["transactions.create", "budgets.read", ...]. Used by authorize()
 * (typically via permissionService's per-request cache) to check access.
 */
async function getPermissionKeysForRole(roleId) {
  const { data, error } = await supabaseAdmin
    .from("role_permissions")
    .select("permissions:permission_id ( key )")
    .eq("role_id", roleId);
  if (error) throw error;
  return (data || []).map((row) => row.permissions?.key).filter(Boolean);
}

async function listPermissions() {
  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("id, key, description")
    .order("key", { ascending: true });
  if (error) throw error;
  return data;
}

module.exports = {
  listRoles,
  findRoleByKey,
  getPermissionKeysForRole,
  listPermissions,
};
