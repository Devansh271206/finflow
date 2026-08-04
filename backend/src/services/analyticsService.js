/**
 * Analytics Service
 * ------------------------------------------------------------------
 * Pure business-logic layer for the /api/analytics endpoints:
 * expense-by-category, income vs expense, monthly/weekly spending,
 * cash flow trend, and savings growth over time.
 *
 * Sprint 1 cutover: workspace_id is now required, not optional, in
 * fetchTransactions (the single scoping point every function below
 * routes through) — matching transactionRepository.js/dashboardService.js.
 * getSavingsGrowth no longer reads from `goals` — that table is marked
 * for deprecation per PRD §11.4, so this now always uses the
 * cumulative-cash-flow fallback the old code already had, rather than
 * fixing dead-end logic.
 */

const { supabaseAdmin } = require("../config/supabase");
const ApiError = require("../utils/ApiError");

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ISO week key, e.g. "2026-W27"
function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function fetchTransactions(userId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("amount, type, category, category_id, transaction_date, created_at")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);

  if (error) throw new ApiError(500, "Failed to fetch transactions for analytics", error.message);
  return data || [];
}

// Expense totals grouped by category (for pie/donut charts).
async function getExpenseByCategory(userId, workspaceId) {
  const transactions = await fetchTransactions(userId, workspaceId);
  const byCategory = new Map();

  transactions
    .filter((t) => t.type !== "income")
    .forEach((t) => {
      const key = t.category || "Uncategorized";
      byCategory.set(key, (byCategory.get(key) || 0) + Math.abs(Number(t.amount || 0)));
    });

  return Array.from(byCategory.entries()).map(([category, total]) => ({
    category,
    total: Math.round(total * 100) / 100,
  }));
}

// Monthly income vs expense totals (trailing 6 months) for bar charts.
async function getIncomeVsExpense(userId, workspaceId) {
  const transactions = await fetchTransactions(userId, workspaceId);
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }

  const buckets = Object.fromEntries(months.map((m) => [m, { month: m, income: 0, expenses: 0 }]));

  transactions.forEach((t) => {
    const d = new Date(t.transaction_date || t.created_at);
    if (Number.isNaN(d.getTime())) return;
    const key = monthKey(d);
    if (!buckets[key]) return;
    if (t.type === "income") {
      buckets[key].income += Number(t.amount || 0);
    } else {
      buckets[key].expenses += Math.abs(Number(t.amount || 0));
    }
  });

  return months.map((m) => buckets[m]);
}

// Daily spend total for the current month (for a line/area chart).
async function getMonthlySpending(userId, workspaceId) {
  const transactions = await fetchTransactions(userId, workspaceId);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const daily = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    amount: 0,
  }));

  transactions
    .filter((t) => t.type !== "income")
    .forEach((t) => {
      const d = new Date(t.transaction_date || t.created_at);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      daily[d.getDate() - 1].amount += Math.abs(Number(t.amount || 0));
    });

  return daily.map((d) => ({ ...d, amount: Math.round(d.amount * 100) / 100 }));
}

// Weekly spend totals for the trailing 8 weeks (for a line chart).
async function getWeeklySpending(userId, workspaceId) {
  const transactions = await fetchTransactions(userId, workspaceId);
  const now = new Date();

  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = weekKey(d);
    if (!weeks.find((w) => w.week === key)) weeks.push({ week: key, amount: 0 });
  }
  const weekMap = new Map(weeks.map((w) => [w.week, w]));

  transactions
    .filter((t) => t.type !== "income")
    .forEach((t) => {
      const d = new Date(t.transaction_date || t.created_at);
      if (Number.isNaN(d.getTime())) return;
      const key = weekKey(d);
      const bucket = weekMap.get(key);
      if (bucket) bucket.amount += Math.abs(Number(t.amount || 0));
    });

  return weeks.map((w) => ({ ...w, amount: Math.round(w.amount * 100) / 100 }));
}

// Cumulative net cash flow over the trailing 6 months.
async function getCashFlowTrend(userId, workspaceId) {
  const incomeVsExpense = await getIncomeVsExpense(userId, workspaceId);
  let cumulative = 0;

  return incomeVsExpense.map((m) => {
    const net = m.income - m.expenses;
    cumulative += net;
    return {
      month: m.month,
      net: Math.round(net * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
    };
  });
}

// Cumulative savings growth over time, derived purely from net cash flow
// accumulation. (Previously blended in `goals.saved_amount` when goals
// existed — removed per PRD §11.4, goals is deprecated.)
async function getSavingsGrowth(userId, workspaceId) {
  const cashFlowTrend = await getCashFlowTrend(userId, workspaceId);
  return cashFlowTrend.map((m) => ({ month: m.month, savings: Math.max(m.cumulative, 0) }));
}

module.exports = {
  getExpenseByCategory,
  getIncomeVsExpense,
  getMonthlySpending,
  getWeeklySpending,
  getCashFlowTrend,
  getSavingsGrowth,
};