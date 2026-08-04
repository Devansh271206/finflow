/**
 * Budget Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for `budgets`,
 * plus the spend-aggregation query that replaces the old dual-key
 * (category_id OR lowercased category name) hack that lived in
 * budgetController.js's attachSpendData(). See migrations/
 * 005_budgets_redesign.sql for the target schema this assumes.
 *
 * Table: budgets
 * Columns: id, workspace_id, department_id, category_id, user_id,
 *          period_type ('monthly'|'quarterly'|'annual'), period_start,
 *          amount_limit, amount_spent, monthly_limit, month, year,
 *          created_at, updated_at
 *
 * Root-cause fix: transactions now reliably carry both workspace_id and
 * category_id (Phase F.1 + F.3), so spend can be joined on
 * (workspace_id, category_id) directly — no more falling back to
 * matching on a lowercased free-text category name.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = `
  id, workspace_id, department_id, category_id, user_id,
  period_type, period_start, amount_limit, amount_spent,
  monthly_limit, month, year, created_at, updated_at,
  categories:category_id ( id, name, icon, color ),
  departments:department_id ( id, name )
`;

async function listByWorkspace(workspaceId, filters = {}) {
  const { departmentId, periodStart } = filters;

  let query = supabaseAdmin
    .from("budgets")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (departmentId) query = query.eq("department_id", departmentId);
  if (periodStart) query = query.eq("period_start", periodStart);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("budgets")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("budgets")
    .insert([payload])
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function update(id, workspaceId, payload) {
  const { data, error } = await supabaseAdmin
    .from("budgets")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Computes actual spend for a set of budgets, scoped correctly by
 * workspace_id + category_id (falling back to department_id only when a
 * budget has no category_id, e.g. a department-wide budget), and bounded
 * to each budget's period_start..period_end window. This replaces the
 * old attachSpendData() name-matching hack entirely.
 *
 * Sprint 4 fix (confirmed with product owner): only transactions with
 * approval_status 'approved' or 'reimbursed' count toward spend, plus
 * NULL (transactions predating the approval workflow / not routed
 * through it at all — treated as exempt rather than silently zeroed
 * out). Before this fix, a 'draft', 'submitted', 'under_review', or
 * even 'rejected' expense inflated budget utilization identically to
 * an approved one — which defeated the entire point of having an
 * approval workflow. See migrations/009_expense_approval_workflow.sql.
 */
async function computeSpendForBudgets(workspaceId, budgets) {
  if (!budgets.length) return new Map();

  const { data: transactions, error } = await supabaseAdmin
    .from("transactions")
    .select("amount, type, category_id, department_id, transaction_date, approval_status")
    .eq("workspace_id", workspaceId)
    .neq("type", "income")
    .or("approval_status.in.(approved,reimbursed),approval_status.is.null");

  if (error) throw error;

  const rows = transactions || [];

  const spendByBudgetId = new Map();

  for (const budget of budgets) {
    const periodStart = budget.period_start ? new Date(budget.period_start) : null;
    const periodEnd = periodStart ? addPeriod(periodStart, budget.period_type) : null;

    const matching = rows.filter((t) => {
      const inPeriod =
        !periodStart || !periodEnd
          ? true
          : new Date(t.transaction_date) >= periodStart && new Date(t.transaction_date) < periodEnd;

      if (!inPeriod) return false;

      if (budget.category_id) return t.category_id === budget.category_id;
      if (budget.department_id) return t.department_id === budget.department_id;
      return false;
    });

    const spent = matching.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
    spendByBudgetId.set(budget.id, Math.round(spent));
  }

  return spendByBudgetId;
}

function addPeriod(date, periodType) {
  const d = new Date(date);
  if (periodType === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else if (periodType === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Persists the freshly computed amount_spent back onto each budget row.
 * Called after computeSpendForBudgets so amount_spent stays a queryable,
 * indexable column (PRD §11.3) rather than only ever existing at read
 * time.
 */
async function persistSpend(spendByBudgetId) {
  const updates = Array.from(spendByBudgetId.entries()).map(([id, amount_spent]) =>
    supabaseAdmin.from("budgets").update({ amount_spent }).eq("id", id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
}

module.exports = {
  listByWorkspace,
  findByIdInWorkspace,
  create,
  update,
  remove,
  computeSpendForBudgets,
  persistSpend,
  SELECT_COLUMNS,
};