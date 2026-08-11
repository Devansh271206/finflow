/**
 * Membership Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for `memberships`.
 * This is the table resolveWorkspace() and authorize() depend on.
 *
 * Phase 2.1.1 addition: listByWorkspaceDetailed / findByIdInWorkspace /
 * countActiveAdmins / update / findProfileByEmail — added to back the
 * Team Management admin page. membershipService.js already called the
 * first four; they did not exist here yet.
 */

const { supabaseAdmin } = require("../config/supabase");

const MEMBER_DETAIL_COLUMNS = `
  id, workspace_id, user_id, department_id, role_id, status, joined_at,
  roles:role_id ( id, key, name ),
  departments:department_id ( id, name )
`;

async function attachProfile(row) {
  if (!row) return row;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("id", row.user_id)
    .maybeSingle();
  row.profiles = data || null;
  return row;
}

async function attachProfiles(rows) {
  if (!rows || rows.length === 0) return rows;
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);
  const profileMap = (data || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});
  return rows.map((r) => ({ ...r, profiles: profileMap[r.user_id] || null }));
}

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

// ------------------------------------------------------------------
// Team Management additions (Phase 2.1.1)
// ------------------------------------------------------------------

/**
 * List members of a workspace with full display detail (role, department,
 * profile name/email/avatar) plus optional filters, for the Team
 * Management admin page.
 *
 * filters:
 *   search      - matches profile full_name or email (case-insensitive,
 *                 partial). Applied client-side after fetch, since
 *                 PostgREST can't ilike across an embedded relation in a
 *                 single query without a view/RPC — see note below.
 *   role        - role key (e.g. "admin", "finance_ops")
 *   department  - department_id
 *   status      - "active" | "invited" | "suspended"
 */
async function listByWorkspaceDetailed(workspaceId, filters = {}) {
  const { role, department, status } = filters;

  let query = supabaseAdmin
    .from("memberships")
    .select(MEMBER_DETAIL_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  if (department) {
    query = query.eq("department_id", department);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = await attachProfiles(data || []);

  // Role filter: `role` arrives as a role key (frontend doesn't have the
  // role_id handy), and the embedded `roles` relation can't be filtered
  // by a nested column directly in the same select, so filter in memory.
  if (role) {
    rows = rows.filter((r) => r.roles?.key === role);
  }

  // Search filter: same reasoning — profiles is an embedded relation.
  const search = (filters.search || "").trim().toLowerCase();
  if (search) {
    rows = rows.filter((r) => {
      const name = r.profiles?.full_name?.toLowerCase() || "";
      const email = r.profiles?.email?.toLowerCase() || "";
      return name.includes(search) || email.includes(search);
    });
  }

  return rows;
}

/**
 * Scoped lookup — confirms a membership belongs to the given workspace
 * before the service acts on it (defense-in-depth alongside RLS).
 * Returns the same detail shape as listByWorkspaceDetailed's rows so
 * callers (service guards, controller responses) have role/status/
 * workspace_id available without a second query.
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select(MEMBER_DETAIL_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return attachProfile(data);
}

/**
 * Count active memberships holding the given admin role in a workspace.
 * Used by membershipService.assertNotLastActiveAdmin to block an update
 * that would leave the workspace with zero active admins.
 */
async function countActiveAdmins(workspaceId, adminRoleId) {
  const { count, error } = await supabaseAdmin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role_id", adminRoleId)
    .eq("status", "active");
  if (error) throw error;
  return count || 0;
}

/**
 * Partial update — role_id, department_id, and/or status. Never accepts
 * workspace_id in payload; callers must not allow a membership to be
 * reassigned across workspaces.
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .update(payload)
    .eq("id", id)
    .select(MEMBER_DETAIL_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return attachProfile(data);
}

/**
 * Look up a registered user by email address for the "add existing user
 * to workspace" flow.
 *
 * Strategy: the `profiles` table does NOT store an email column
 * (authController.upsert only writes id, full_name, currency, theme).
 * The authoritative email record lives in Supabase Auth (auth.users).
 * We use the service-role Admin API to find the auth user by email,
 * then return their profile row by the resolved user_id.
 *
 * `admin.listUsers` paginates (max 1000 per page), so this walks every
 * page rather than only inspecting the first page — a naive single-page
 * lookup silently misses users once the project has more than 1000 auth
 * users.
 *
 * Returns null when no auth user with that email exists.
 */
async function findProfileByEmail(email) {
  const normalised = email.trim().toLowerCase();
  let authUser = null;

  const PER_PAGE = 1000;
  let page = 1;
  while (!authUser && page <= 100) {
    const { data: listData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });

    if (listError) throw listError;

    const users = listData?.users || [];
    authUser = users.find((u) => (u.email || "").toLowerCase() === normalised) || null;

    if (users.length < PER_PAGE) break; // last page reached
    page += 1;
  }

  if (!authUser) return null;

  // Step 2 — fetch their profile row by the resolved user_id.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) throw profileError;

  // Return a merged object so callers always get id + email.
  // If the profile row doesn't exist yet (edge case: user registered
  // before the profiles upsert was added), fall back to auth metadata.
  return {
    id: authUser.id,
    email: authUser.email,
    full_name:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      null,
    avatar_url: profile?.avatar_url || null,
  };
}

module.exports = {
  findActiveMembership,
  findFirstActiveMembership,
  create,
  listByWorkspace,
  listByWorkspaceDetailed,
  findByIdInWorkspace,
  countActiveAdmins,
  update,
  findProfileByEmail,
};