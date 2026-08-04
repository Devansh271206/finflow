/**
 * Platform Admin Repository
 * ------------------------------------------------------------------
 * Thin data-access layer for Platform Admin's organization management
 * and platform-wide stats. Reuses `companies` (this codebase's name
 * for "organization") rather than a new table — companyRepository.js
 * already owns basic CRUD; this repository owns the platform-admin-
 * specific reads (lifecycle actions, cross-org stats) that
 * companyRepository.js has no reason to know about.
 *
 * Employee/workspace counts are derived via workspace_id, not a
 * denormalized company_id on employees — employees are workspace-
 * scoped (see employeeRepository.js), and a company can have multiple
 * workspaces (see workspaceRepository.findByCompany), so "how many
 * employees does this org have" is a two-step lookup: company ->
 * workspace ids -> employee count where workspace_id IN (...).
 *
 * Explicitly NOT included (out of v1 scope per this sprint's
 * instructions — see platformAdminService.js header for the full
 * list): billing/subscription data, feature flags, health monitoring,
 * real audit-log storage (no audit_logs table exists in this schema
 * snapshot to read from).
 */

const { supabaseAdmin } = require("../config/supabase");

const ORG_SELECT_COLUMNS =
  "id, name, slug, logo, industry, currency, timezone, country, owner_user_id, status, created_at, updated_at, deleted_at";

async function getWorkspaceIdsForCompany(companyId) {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("company_id", companyId);
  if (error) throw error;
  return (data || []).map((w) => w.id);
}

async function countEmployeesForWorkspaces(workspaceIds) {
  if (!workspaceIds.length) return 0;
  const { count, error } = await supabaseAdmin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .in("workspace_id", workspaceIds);
  if (error) throw error;
  return count || 0;
}

/**
 * List all organizations (excluding soft-deleted), optionally filtered
 * by status, with a per-org employee count and workspace count for the
 * Organizations list page. Not paginated in v1 — organization counts
 * for a single-instance FinFlow deployment are expected to be in the
 * dozens/low hundreds, not a scale that needs server-side pagination
 * yet; revisit if that assumption stops holding.
 */
async function listOrganizations({ status } = {}) {
  let query = supabaseAdmin
    .from("companies")
    .select(ORG_SELECT_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: companies, error } = await query;
  if (error) throw error;

  return Promise.all(
    (companies || []).map(async (company) => {
      const workspaceIds = await getWorkspaceIdsForCompany(company.id);
      const employeeCount = await countEmployeesForWorkspaces(workspaceIds);
      return { ...company, workspaceCount: workspaceIds.length, employeeCount };
    })
  );
}

async function getOrganizationById(id) {
  const { data: company, error } = await supabaseAdmin
    .from("companies")
    .select(ORG_SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!company) return null;

  const workspaceIds = await getWorkspaceIdsForCompany(id);
  const employeeCount = await countEmployeesForWorkspaces(workspaceIds);

  return { ...company, workspaceCount: workspaceIds.length, employeeCount };
}

async function setOrganizationStatus(id, status) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(ORG_SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function softDeleteOrganization(id) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(ORG_SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Platform-wide counters for the Platform Dashboard / Platform
 * Analytics pages. Kept as a handful of independent count queries
 * (not one giant joined query) so a slow/failing one doesn't take the
 * rest down — Promise.all still parallelizes them.
 */
async function getPlatformStats() {
  const [{ count: totalOrgs }, { count: activeOrgs }, { count: suspendedOrgs }, { count: totalEmployees }] =
    await Promise.all([
      supabaseAdmin.from("companies").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabaseAdmin
        .from("companies")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "active"),
      supabaseAdmin
        .from("companies")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "suspended"),
      supabaseAdmin.from("employees").select("id", { count: "exact", head: true }),
    ]);

  return {
    totalOrganizations: totalOrgs || 0,
    activeOrganizations: activeOrgs || 0,
    suspendedOrganizations: suspendedOrgs || 0,
    totalEmployees: totalEmployees || 0,
  };
}

/**
 * Organization signups per month for the last N months, for a simple
 * growth chart on Platform Analytics. Aggregated in JS rather than a
 * SQL date_trunc — supabase-js doesn't expose raw grouped aggregates
 * without a Postgres function, and this dataset (v1 org counts) is
 * small enough that fetching created_at values and grouping client-
 * side is not a meaningful cost.
 */
async function getOrganizationGrowth(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);

  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("created_at")
    .is("deleted_at", null)
    .gte("created_at", since.toISOString());
  if (error) throw error;

  const buckets = new Map();
  (data || []).forEach((row) => {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

module.exports = {
  listOrganizations,
  getOrganizationById,
  setOrganizationStatus,
  softDeleteOrganization,
  getPlatformStats,
  getOrganizationGrowth,
};
