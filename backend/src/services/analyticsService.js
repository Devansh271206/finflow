/**
 * Analytics Service
 * ------------------------------------------------------------------
 * Pure business-logic layer for the /api/analytics endpoints:
 * expense-by-category, income vs expense, monthly/weekly spending,
 * cash flow trend, and savings growth over time.
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

async function fetchTransactions(userId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("amount, type, category, category_id, transaction_date, created_at")
    .eq("user_id", userId);

  if (error) throw new ApiError(500, "Failed to fetch transactions for analytics", error.message);
  return data || [];
}

// Expense totals grouped by category (for pie/donut charts).
async function getExpenseByCategory(userId) {
  const transactions = await fetchTransactions(userId);
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
async function getIncomeVsExpense(userId) {
  const transactions = await fetchTransactions(userId);
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
async function getMonthlySpending(userId) {
  const transactions = await fetchTransactions(userId);
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
async function getWeeklySpending(userId) {
  const transactions = await fetchTransactions(userId);
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
async function getCashFlowTrend(userId) {
  const incomeVsExpense = await getIncomeVsExpense(userId);
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

// Cumulative savings (goals saved_amount) growth over time, based on goal updates,
// falling back to net cash flow accumulation if no goals exist.
async function getSavingsGrowth(userId) {
  const { data: goals, error } = await supabaseAdmin
    .from("goals")
    .select("saved_amount, created_at")
    .eq("user_id", userId);

  if (error) throw new ApiError(500, "Failed to fetch goals for savings growth", error.message);

  if (goals && goals.length > 0) {
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.saved_amount || 0), 0);
    const cashFlowTrend = await getCashFlowTrend(userId);
    // Distribute total saved proportionally across the cumulative cash flow trend
    // to give a visual growth curve when explicit historical snapshots aren't stored.
    return cashFlowTrend.map((m, idx) => ({
      month: m.month,
      savings: Math.round(((totalSaved * (idx + 1)) / cashFlowTrend.length) * 100) / 100,
    }));
  }

  const cashFlowTrend = await getCashFlowTrend(userId);
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
