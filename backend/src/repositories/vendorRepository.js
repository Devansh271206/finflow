/**
 * Vendor Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for `vendors`.
 * This file was an empty stub before Sprint 3 — vendorController.js
 * was already written against these exact function names
 * (listByWorkspace, findByIdInWorkspace, findByNameInWorkspace, create,
 * update); every transaction with a vendor_id crashed until this
 * existed (see transactionService.js's assertVendorInWorkspace guard,
 * added in Sprint 1 specifically to fail cleanly until this landed).
 *
 * Table: vendors
 * Columns: id, workspace_id, name, contact_name, contact_email,
 *          contact_phone, tax_id, is_active, is_subscription,
 *          billing_cycle, auto_renew, license_count, license_used,
 *          last_used_at, functional_tag, owner_department_id,
 *          next_billing_date, status, created_at, updated_at
 *
 * No hard-delete function exposed — same soft-delete-only rule as
 * departments/employees (a vendor referenced by transaction history is
 * deactivated via update({ is_active: false }), never removed).
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, name, contact_name, contact_email, contact_phone, tax_id, " +
  "is_active, is_subscription, billing_cycle, auto_renew, license_count, " +
  "license_used, last_used_at, functional_tag, owner_department_id, " +
  "next_billing_date, status, created_at, updated_at";

/**
 * Lists vendors for a workspace. Returns both active and inactive rows
 * by default (frontend badges/filters), matching the existing comment
 * in vendorController.js's getVendors handler. Pass
 * { subscriptionsOnly: true } for the Subscriptions view (PRD §15.7 —
 * a filtered view of this same table, not a separate endpoint's data
 * source).
 */
async function listByWorkspace(workspaceId, { subscriptionsOnly = false } = {}) {
  let query = supabaseAdmin
    .from("vendors")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (subscriptionsOnly) {
    query = query.eq("is_subscription", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Case-insensitive name lookup — backs vendorController.js's existing
 * duplicate-name checks in createVendor/updateVendor. Matches the
 * uq_vendors_workspace_name index (migration 008) so the JS-level
 * check and the DB constraint agree on what "duplicate" means.
 */
async function findByNameInWorkspace(workspaceId, name) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Vendors with a next_billing_date within the given window, still
 * status = 'pending_review' — backs the Renewal Risk KPI (PRD's KPI
 * table: "next_billing_date within 30 days and status not yet
 * reviewed"). Used by getVendorAnalytics(), not exposed as its own
 * route — it's one ingredient of the analytics response, not a
 * separate resource.
 */
async function findRenewalRisks(workspaceId, withinDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .eq("status", "pending_review")
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", cutoff.toISOString().slice(0, 10))
    .order("next_billing_date", { ascending: true });
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Total expense spend per vendor for a workspace — backs the Vendor
 * Concentration KPI (top 5 vendors' share of total vendor spend).
 * Supabase's JS client has no GROUP BY, so this fetches vendor_id +
 * amount for expense transactions with a vendor set and aggregates in
 * JS, same pattern dashboardService.js/analyticsService.js already
 * use for their own aggregations.
 */
async function getSpendByVendor(workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("vendor_id, amount")
    .eq("workspace_id", workspaceId)
    .eq("type", "expense")
    .not("vendor_id", "is", null);
  if (error) throw error;

  const totalsByVendor = new Map();
  for (const row of data) {
    const current = totalsByVendor.get(row.vendor_id) || 0;
    totalsByVendor.set(row.vendor_id, current + Number(row.amount));
  }

  const vendorIds = [...totalsByVendor.keys()];
  if (vendorIds.length === 0) return [];

  const { data: vendors, error: vendorError } = await supabaseAdmin
    .from("vendors")
    .select("id, name")
    .in("id", vendorIds);
  if (vendorError) throw vendorError;

  const nameById = new Map(vendors.map((v) => [v.id, v.name]));

  return vendorIds.map((vendorId) => ({
    vendorId,
    vendorName: nameById.get(vendorId) || "Unknown vendor",
    total: totalsByVendor.get(vendorId),
  }));
}

module.exports = {
  listByWorkspace,
  findByIdInWorkspace,
  findByNameInWorkspace,
  findRenewalRisks,
  getSpendByVendor,
  create,
  update,
};
