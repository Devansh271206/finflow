/**
 * Workspace Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for `workspaces`.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = "id, company_id, name, slug, status, created_at";

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByCompany(companyId) {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * List every workspace a user belongs to (active memberships only),
 * joined with company info for the workspace switcher UI.
 */
async function findByUser(userId) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select(
      `
      workspace_id,
      role_id,
      department_id,
      status,
      workspaces:workspace_id (
        id, company_id, name, slug, status, created_at,
        companies:company_id ( id, name, slug, logo, currency )
      ),
      roles:role_id ( id, key, name )
      `
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;

  return (data || []).map((row) => ({
    workspace: row.workspaces,
    company: row.workspaces?.companies,
    role: row.roles,
    department_id: row.department_id,
  }));
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function slugExistsInCompany(companyId, slug) {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("company_id", companyId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

module.exports = {
  findById,
  findByCompany,
  findByUser,
  create,
  update,
  slugExistsInCompany,
  SELECT_COLUMNS,
};
