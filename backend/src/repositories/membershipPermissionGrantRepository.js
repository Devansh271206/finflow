/**
 * Membership Permission Grant Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `membership_permission_grants` — see migrations/
 * 007_employee_system_of_record.sql for the full rationale. This is
 * the general per-membership permission override mechanism; a grant
 * here is checked IN ADDITION TO (never as a replacement for)
 * role_permissions, and only for permission keys that are explicitly
 * documented as "not implied by role" (currently just
 * salary.read_department).
 *
 * Table: membership_permission_grants
 * Columns: id, membership_id, permission_key, granted_by, granted_at,
 *          revoked_by, revoked_at
 *
 * Grants are never hard-deleted — revoke() sets revoked_by/revoked_at
 * so there's a durable history of who had access to what and when.
 * "Active" means revoked_at IS NULL.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, membership_id, permission_key, granted_by, granted_at, revoked_by, revoked_at";

/**
 * Checks for a currently-active grant of a specific permission to a
 * specific membership. This is the function permission-checking code
 * calls — not listActiveForMembership(), which is for admin UI display.
 */
async function findActiveGrant(membershipId, permissionKey) {
  const { data, error } = await supabaseAdmin
    .from("membership_permission_grants")
    .select(SELECT_COLUMNS)
    .eq("membership_id", membershipId)
    .eq("permission_key", permissionKey)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * All currently-active grants for a membership, for admin UI display
 * (e.g. showing an HR admin what a given teammate currently has access
 * to). Not used by permission-checking code — use findActiveGrant().
 */
async function listActiveForMembership(membershipId) {
  const { data, error } = await supabaseAdmin
    .from("membership_permission_grants")
    .select(SELECT_COLUMNS)
    .eq("membership_id", membershipId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("membership_permission_grants")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Creates a new grant row. Does not check for an existing active grant
 * first — the partial unique index (membership_id, permission_key)
 * WHERE revoked_at IS NULL enforces that at the database level; the
 * service layer should catch the resulting unique-violation and turn
 * it into a clear "already granted" error rather than a raw 500.
 */
async function create({ membershipId, permissionKey, grantedBy }) {
  const { data, error } = await supabaseAdmin
    .from("membership_permission_grants")
    .insert({
      membership_id: membershipId,
      permission_key: permissionKey,
      granted_by: grantedBy,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Revokes an active grant. Scoped by id only — the service layer is
 * responsible for confirming the grant belongs to the caller's
 * workspace (via its membership) before calling this.
 */
async function revoke(id, revokedBy) {
  const { data, error } = await supabaseAdmin
    .from("membership_permission_grants")
    .update({ revoked_by: revokedBy, revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  findActiveGrant,
  listActiveForMembership,
  findById,
  create,
  revoke,
};
