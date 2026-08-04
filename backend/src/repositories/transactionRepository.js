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
 * Sprint 1 cutover (see migrations/006_transactions_workspace_cutover.sql):
 * workspace_id is now NOT NULL and required by every function below —
 * the old Phase 1 "dual-scope, filter only if resolved" bridging mode
 * has been removed. listForUser() always filters by workspace_id (no
 * more silent fall-back to a user's transactions across every
 * workspace they belong to). findByIdForUser/updateForUser/deleteForUser
 * accept an additional optional workspaceId argument so callers can
 * scope single-row access the same way — optional only so this lands
 * without forcing a simultaneous transactionController.js rewrite;
 * every call site should pass it (see transactionController.js update
 * in the same sprint). The user_id filter stays in place alongside
 * workspace_id — both are real, meaningful scopes now (a workspace can
 * have many users), not a legacy/replacement pair.
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
 * List transactions for a user within a workspace, with filtering and
 * pagination. workspaceId is required — the caller (transactionController)
 * must reject the request before calling this if no workspace resolved,
 * the same pattern budgetController/categoryController already use.
 * Returns { rows, count } so the controller can build its own pagination
 * envelope.
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
    .eq("workspace_id", workspaceId)
    .order("transaction_date", { ascending: false });

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
 * Sprint 10 (Role-Based Dashboard System): workspace-wide listing,
 * deliberately WITHOUT a user_id filter — the all-users counterpart to
 * listForUser() above. Needed because Finance/Executive/Dept-Lead
 * dashboards must aggregate transactions across every employee in the
 * workspace (or department), not just the logged-in caller's own rows.
 * Mirrors listForUser's filter/pagination shape exactly so the two stay
 * interchangeable for a controller/service that already knows how to
 * consume { rows, count, page, pageSize }; departmentId is additive
 * (listForUser has no equivalent since a personal transaction list was
 * never department-scoped).
 */
async function listForWorkspace(
  workspaceId,
  {
    type,
    categoryId,
    vendorId,
    employeeId,
    departmentId,
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
    .eq("workspace_id", workspaceId)
    .order("transaction_date", { ascending: false });

  if (type) query = query.eq("type", type);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  if (departmentId) query = query.eq("department_id", departmentId);
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
 * the controller acts on it (defense-in-depth alongside RLS). Pass
 * workspaceId to also confirm it belongs to the resolved workspace (a
 * user who is a member of multiple workspaces should not be able to
 * fetch a transaction from workspace B while operating in workspace A).
 */
async function findByIdForUser(id, userId, workspaceId) {
  let query = supabaseAdmin
    .from("transactions")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId);

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Sprint 4: workspace-only lookup, deliberately WITHOUT a user_id
 * filter — used by approvalService.js, where the caller (a Dept Lead
 * or Finance approving an expense) is never the transaction's own
 * creator. findByIdForUser() above is the wrong tool for this because
 * it requires userId to match; this is the intentional workspace-scope-
 * only counterpart.
 */
async function findByIdInWorkspaceForApproval(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
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
 * Partial update, scoped to the owning user and (when provided) the
 * resolved workspace. Never accepts user_id or workspace_id in payload;
 * callers must not allow a transaction to be reassigned across
 * users/workspaces via this path.
 */
async function updateForUser(id, userId, payload, workspaceId) {
  let query = supabaseAdmin
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId);

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  const { data, error } = await query.select(SELECT_COLUMNS).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Deletes a transaction, scoped to the owning user and (when provided)
 * the resolved workspace.
 */
async function deleteForUser(id, userId, workspaceId) {
  let query = supabaseAdmin
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  listForUser,
  listForWorkspace,
  findByIdForUser,
  findByIdInWorkspaceForApproval,
  create,
  updateForUser,
  deleteForUser,
  SELECT_COLUMNS,
};