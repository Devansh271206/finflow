import { getTransactions } from "./transactionService";
import { getBudgets } from "./budgetService";

function formatMonthLabel(date) {
  return date.toLocaleString("en-IN", { month: "short" });
}

export async function getAnalyticsData() {
  try {
    const [{ data: transactions = [] }, { data: budgets = [] }] = await Promise.all([getTransactions(), getBudgets()]);

    let incomeSum = 0;
    let expenseSum = 0;

    transactions.forEach((transaction) => {
      const amount = Number(transaction.amount || 0);
      if (transaction.type === "income") {
        incomeSum += amount;
      } else {
        expenseSum += Math.abs(amount);
      }
    });

    const categoryBreakdownData = budgets.map((budget) => ({
      name: budget.category,
      value: Math.round(budget.spent),
      color: budget.color === "emerald" ? "#10b981" : budget.color === "blue" ? "#3b82f6" : budget.color === "amber" ? "#f59e0b" : budget.color === "purple" ? "#a855f7" : budget.color === "rose" ? "#f43f5e" : "#ec4899",
    }));

    const dailySpendingData = [
      { day: "Mon", amount: 0 },
      { day: "Tue", amount: 0 },
      { day: "Wed", amount: 0 },
      { day: "Thu", amount: 0 },
      { day: "Fri", amount: 0 },
      { day: "Sat", amount: 0 },
      { day: "Sun", amount: 0 },
    ];

    transactions
      .filter((transaction) => transaction.type !== "income")
      .forEach((transaction) => {
        const date = transaction.transaction_date || transaction.created_at || transaction.date;
        if (!date) return;
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return;
        const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parsed.getDay()];
        const target = dailySpendingData.find((entry) => entry.day === day);
        if (target) {
          target.amount += Math.abs(Number(transaction.amount || 0));
        }
      });

    const yearlyTrendData = [];
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      const monthLabel = formatMonthLabel(date);
      const monthTransactions = transactions.filter((transaction) => {
        const txDate = new Date(transaction.transaction_date || transaction.created_at || transaction.date);
        return !Number.isNaN(txDate.getTime()) && txDate.getMonth() === date.getMonth() && txDate.getFullYear() === date.getFullYear();
      });
      let monthlyIncome = 0;
      let monthlyExpense = 0;
      monthTransactions.forEach((transaction) => {
        const amount = Number(transaction.amount || 0);
        if (transaction.type === "income") {
          monthlyIncome += amount;
        } else {
          monthlyExpense += Math.abs(amount);
        }
      });
      yearlyTrendData.push({ month: monthLabel, netWorth: Math.round(monthlyIncome - monthlyExpense) });
    }

    const incomeSourcesData = transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((accumulator, transaction) => {
        const existing = accumulator.find((entry) => entry.name === (transaction.merchant || transaction.title || "Income"));
        if (existing) {
          existing.value += Number(transaction.amount || 0);
        } else {
          accumulator.push({ name: transaction.merchant || transaction.title || "Income", value: Number(transaction.amount || 0), fill: "#10b981" });
        }
        return accumulator;
      }, []);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailySpend = new Map();

    transactions
      .filter(t => t.type !== 'income')
      .forEach(t => {
        const dateVal = t.transaction_date || t.created_at || t.date;
        if (!dateVal) return;
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return;
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
        const day = d.getDate();
        dailySpend.set(day, (dailySpend.get(day) || 0) + Math.abs(Number(t.amount || 0)));
      });

    const maxDay = Math.max(0, ...Array.from(dailySpend.values()));
    const heatmapDays = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const amount = dailySpend.get(day) || 0;
      const intensity = maxDay > 0 ? Math.round((amount / maxDay) * 100) : 0;
      return { day, intensity };
    });

    return {
      data: {
        stats: {
          incomeSum,
          expenseSum,
          netCashflow: incomeSum - expenseSum,
          savingsRate: incomeSum > 0 ? Math.round(((incomeSum - expenseSum) / incomeSum) * 100) : 0,
        },
        categoryBreakdownData,
        dailySpendingData,
        yearlyTrendData,
        incomeSourcesData,
        heatmapDays,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}