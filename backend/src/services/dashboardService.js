/**
 * Dashboard Service
 * ------------------------------------------------------------------
 * Pure business-logic layer for computing the metrics shown on the
 * FinFlow dashboard. Kept separate from the controller so the
 * calculations are unit-testable and reusable (e.g. by analyticsService).
 *
 * Sprint 1 cutover: workspace_id is now required, not optional — the old
 * "dual-scoped, filter only if resolved" bridging mode (Phase F.7) has
 * been removed, matching transactionRepository.js. Every function below
 * requires workspaceId; the controller (dashboardController.js) must
 * resolve and pass it, the same guard pattern budgetController.js uses.
 *
 * NOTE: This remains the existing personal-finance-style dashboard
 * (balance/income/expenses/health score). It is NOT the Executive/HR/
 * Finance dashboards from PRD §15.9-15.11 — those are new modules that
 * depend on Employees/Payroll/Vendors data that doesn't exist yet, and
 * are out of scope for this phase.
 */

const { supabaseAdmin } = require("../config/supabase");
const ApiError = require("../utils/ApiError");

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchAllTransactions(userId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, amount, type, category, category_id, payment_method, transaction_date, merchant, title, notes, receipt_url, created_at"
    )
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("transaction_date", { ascending: false });

  if (error) throw new ApiError(500, "Failed to fetch transactions for dashboard", error.message);
  return data || [];
}

async function fetchBudgetsWithSpend(userId, workspaceId, transactions) {
  const { data: budgets, error } = await supabaseAdmin
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);

  if (error) throw new ApiError(500, "Failed to fetch budgets for dashboard", error.message);

  const spentByCategoryId = new Map();
  transactions
    .filter((t) => t.type !== "income")
    .forEach((t) => {
      const key = t.category_id || "uncategorized";
      spentByCategoryId.set(key, (spentByCategoryId.get(key) || 0) + Math.abs(Number(t.amount || 0)));
    });

  return (budgets || []).map((b) => {
    const spent = spentByCategoryId.get(b.category_id || "uncategorized") || 0;
    const limit = Number(b.amount_limit ?? b.monthly_limit ?? 0);
    return {
      id: b.id,
      category_id: b.category_id,
      limit,
      spent: Math.round(spent),
      utilization: limit > 0 ? Math.round((spent / limit) * 100) : 0,
    };
  });
}

/**
 * Computes a 0-100 "Financial Health Score" from a handful of common
 * personal-finance heuristics:
 *   - Savings rate (income retained after expenses)
 *   - Budget adherence (avg utilization across budgets, lower is better)
 *   - Positive cash flow bonus
 */
function computeFinancialHealthScore({ income, expenses, budgets }) {
  const savingsRate = income > 0 ? (income - expenses) / income : 0;
  const savingsScore = Math.max(0, Math.min(1, savingsRate)) * 50; // up to 50 pts

  const avgUtilization = budgets.length
    ? budgets.reduce((sum, b) => sum + Math.min(b.utilization, 150), 0) / budgets.length
    : 50; // neutral if no budgets set
  const budgetScore = Math.max(0, (100 - avgUtilization) / 100) * 35; // up to 35 pts

  const cashFlowScore = income - expenses >= 0 ? 15 : 0; // up to 15 pts

  const score = Math.round(savingsScore + budgetScore + cashFlowScore);
  return Math.max(0, Math.min(100, score));
}

/**
 * Builds the full dashboard payload: balance, income, expenses, cash flow,
 * recent transactions, monthly summary (last 6 months), budget utilization,
 * and an overall financial health score. workspaceId is required — the
 * caller (dashboardController.js) must reject the request before calling
 * this if no workspace resolved.
 */
async function getDashboardSummary(userId, workspaceId) {
  const transactions = await fetchAllTransactions(userId, workspaceId);

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const expenses = transactions
    .filter((t) => t.type !== "income")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const balance = income - expenses;
  const cashFlow = balance;

  const recentTransactions = transactions.slice(0, 10);

  // Monthly summary for the trailing 6 months (including current month).
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }

  const monthlyBuckets = Object.fromEntries(
    months.map((m) => [m, { month: m, income: 0, expenses: 0 }])
  );

  transactions.forEach((t) => {
    const d = new Date(t.transaction_date || t.created_at);
    if (Number.isNaN(d.getTime())) return;
    const key = monthKey(d);
    if (!monthlyBuckets[key]) return; // outside the 6-month window
    if (t.type === "income") {
      monthlyBuckets[key].income += Number(t.amount || 0);
    } else {
      monthlyBuckets[key].expenses += Math.abs(Number(t.amount || 0));
    }
  });

  const monthlySummary = months.map((m) => ({
    ...monthlyBuckets[m],
    net: monthlyBuckets[m].income - monthlyBuckets[m].expenses,
  }));

  const budgetUtilization = await fetchBudgetsWithSpend(userId, workspaceId, transactions);

  const financialHealthScore = computeFinancialHealthScore({
    income,
    expenses,
    budgets: budgetUtilization,
  });

  return {
    balance: Math.round(balance * 100) / 100,
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    cashFlow: Math.round(cashFlow * 100) / 100,
    recentTransactions,
    monthlySummary,
    budgetUtilization,
    financialHealthScore,
  };
}

module.exports = { getDashboardSummary, fetchAllTransactions, monthKey };