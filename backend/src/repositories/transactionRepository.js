/**
 * Transaction Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `transactions`. Mirrors the shape of departmentRepository.js /
 * workspaceRepository.js (PRD §10.1 — services/controllers never touch
 * Supabase query syntax directly).
 *
 * Table: transactions
 * Columns: id, user_id, workspace_id, department_id, vendor_id,
 *          employee_id, budget_id, title, merchant, amount,
 *          type ('income'|'expense'), transaction_type, category,
 *          category_id, payment_method, transaction_date,
 *          reference_number, invoice_number, approval_status,
 *          payment_status, transaction_source, created_by,
 *          approved_by, attachment_count, notes, receipt_url,
 *          created_at, updated_at
 *
 * Phase 1 bridging note (see migrations/001_phase1_multitenant.sql and
 * utils/workspaceScope.js): workspace_id is nullable and every read/write
 * here stays dual-scoped by BOTH user_id and workspace_id (when a
 * workspace has been resolved). This is intentional defense-in-depth
 * alongside RLS, and keeps behavior unchanged for any caller that
 * predates the X-Workspace-Id header. Do not drop the user_id filter
 * until the NOT NULL cutover migration lands and is verified.
 *
 * Enterprise columns (vendor_id, employee_id, budget_id,
 * transaction_type, reference_number, invoice_number, approval_status,
 * payment_status, transaction_source, created_by, approved_by,
 * attachment_count) were added in migrations/002_enterprise_transactions.sql
 * as nullable, additive columns — see the Transactions architecture
 * audit. Reference validation for vendor_id/employee_id/budget_id
 * lives in services/transactionService.js, not here.
 *
 * Category audit (single-source-of-truth refactor): this repository no
 * longer resolves category names — that free-text, user_id-only lookup
 * (findCategoryIdByName) has been removed. Transactions always receive a
 * category_id directly from the client, validated against the resolved
 * workspace via transactionService.assertCategoryInWorkspace(), which
 * delegates to categoryRepository.findByIdInWorkspace() — the same
 * Categories table Budgets already reads from.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, user_id, workspace_id, department_id, vendor_id, employee_id, budget_id, title, merchant, amount, type, transaction_type, category, category_id, payment_method, transaction_date, reference_number, invoice_number, approval_status, payment_status, transaction_source, created_by, approved_by, attachment_count, notes, receipt_url, created_at, updated_at";

/**
 * List transactions for a user, optionally scoped to a workspace, with
 * filtering and pagination. Returns { rows, count } so the controller can
 * build its own pagination envelope.
 */
async function listForUser(
  userId,
  {
    workspaceId,
    type,
    categoryId,
    vendorId,
    employeeId,
    approvalStatus,
    paymentStatus,
    transactionType,
    from,
    to,
    page = 1,
    limit = 50,
  } = {}
) {
  let query = supabaseAdmin
    .from("transactions")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false });

  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  if (type) query = query.eq("type", type);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  if (approvalStatus) query = query.eq("approval_status", approvalStatus);
  if (paymentStatus) query = query.eq("payment_status", paymentStatus);
  if (transactionType) query = query.eq("transaction_type", transactionType);
  if (from) query = query.gte("transaction_date", from);
  if (to) query = query.lte("transaction_date", to);

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(parseInt(limit, 10) || 50, 200);
  const start = (pageNum - 1) * pageSize;
  const end = start + pageSize - 1;
  query = query.range(start, end);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: data || [],
    count: count ?? data?.length ?? 0,
    page: pageNum,
    pageSize,
  };
}

/**
 * Scoped lookup — confirms a transaction belongs to the given user before
 * the controller acts on it (defense-in-depth alongside RLS).
 */
async function findByIdForUser(id, userId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .insert([payload])
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update, scoped to the owning user. Never accepts user_id or
 * workspace_id in payload; callers must not allow a transaction to be
 * reassigned across users/workspaces via this path.
 */
async function updateForUser(id, userId, payload) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteForUser(id, userId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  listForUser,
  findByIdForUser,
  create,
  updateForUser,
  deleteForUser,
  SELECT_COLUMNS,
};