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

export async function getAIInsights() {
  try {
    const { data: transactions = [] } = await getTransactions();
    const { data: budgets = [] } = await getBudgets();

    const insights = [];

    if (!transactions || transactions.length === 0) {
      insights.push({
        id: "no-data",
        type: "info",
        title: "No transactions yet",
        description: "Add your income and expenses to unlock personalized AI insights about your spending habits.",
        impact: "N/A",
        savingPotential: "N/A",
      });
      return { data: insights, error: null };
    }

    const getDate = (t) => new Date(t.transaction_date || t.created_at || t.date || 0);
    const now = new Date();
    const thisMonthTx = transactions.filter((t) => {
      const d = getDate(t);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthTx = transactions.filter((t) => {
      const d = getDate(t);
      return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
    });

    const sumExpenses = (list) => list
      .filter((t) => t.type !== "income")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

    const thisMonthExpense = sumExpenses(thisMonthTx);
    const lastMonthExpense = sumExpenses(lastMonthTx);

    // 1. Month-over-month spending trend
    if (lastMonthExpense > 0) {
      const pctChange = ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100;
      if (pctChange > 10) {
        insights.push({
          id: "spend-trend-up",
          type: "warning",
          title: "Spending is trending up",
          description: `Your expenses this month (${Math.round(thisMonthExpense).toLocaleString("en-IN")}) are ${Math.round(pctChange)}% higher than last month (${Math.round(lastMonthExpense).toLocaleString("en-IN")}).`,
          impact: "Medium",
          savingPotential: `₹${Math.round(thisMonthExpense - lastMonthExpense).toLocaleString("en-IN")}`,
        });
      } else if (pctChange < -10) {
        insights.push({
          id: "spend-trend-down",
          type: "success",
          title: "Spending is trending down",
          description: `Great work — your expenses this month are ${Math.round(Math.abs(pctChange))}% lower than last month.`,
          impact: "Low",
          savingPotential: "N/A",
        });
      }
    }

    // 2. Over-budget categories
    const overBudget = budgets.filter((b) => b.spent > b.limit && b.limit > 0);
    if (overBudget.length > 0) {
      const totalOverage = overBudget.reduce((sum, b) => sum + (b.spent - b.limit), 0);
      insights.push({
        id: "over-budget",
        type: "danger",
        title: `${overBudget.length} budget${overBudget.length > 1 ? "s" : ""} over limit`,
        description: `You have exceeded your budget in: ${overBudget.map((b) => b.category).join(", ")}.`,
        impact: "High",
        savingPotential: `₹${Math.round(totalOverage).toLocaleString("en-IN")}`,
      });
    } else if (budgets.length > 0) {
      insights.push({
        id: "budget-healthy",
        type: "success",
        title: "Budget discipline looks healthy",
        description: `You are using ${budgets.length} active budget${budgets.length > 1 ? "s" : ""} and staying within your limits across all categories.`,
        impact: "Low",
        savingPotential: "N/A",
      });
    } else {
      insights.push({
        id: "no-budgets",
        type: "info",
        title: "No budgets configured",
        description: "Set up category budgets to get proactive alerts before you overspend.",
        impact: "Medium",
        savingPotential: "N/A",
      });
    }

    // 3. Category concentration
    const catMap = new Map();
    transactions
      .filter((t) => t.type !== "income")
      .forEach((t) => {
        const cat = t.category || "Uncategorized";
        catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(Number(t.amount || 0)));
      });
    const totalExpense = Array.from(catMap.values()).reduce((a, b) => a + b, 0);
    const sortedCats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0 && totalExpense > 0) {
      const [topCat, topAmt] = sortedCats[0];
      const share = (topAmt / totalExpense) * 100;
      if (share > 40) {
        insights.push({
          id: "category-concentration",
          type: "warning",
          title: `${topCat} dominates your spending`,
          description: `${Math.round(share)}% of your total expenses come from ${topCat}. Diversifying or trimming this category could improve your cash flow.`,
          impact: "Medium",
          savingPotential: `₹${Math.round(topAmt * 0.1).toLocaleString("en-IN")}`,
        });
      }
    }

    // 4. Savings rate insight
    const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
    if (totalIncome > 0) {
      const savingsRate = Math.round(((totalIncome - totalExpense) / totalIncome) * 100);
      if (savingsRate >= 30) {
        insights.push({
          id: "savings-excellent",
          type: "success",
          title: "Excellent savings rate",
          description: `You are saving ${savingsRate}% of your income, well above the recommended 20-30% benchmark.`,
          impact: "Low",
          savingPotential: "N/A",
        });
      } else if (savingsRate < 10) {
        insights.push({
          id: "savings-low",
          type: "warning",
          title: "Low savings rate",
          description: `You are currently saving only ${savingsRate}% of your income. Consider reviewing discretionary spending to build a stronger buffer.`,
          impact: "High",
          savingPotential: "N/A",
        });
      }
    }

    return { data: insights, error: null };
  } catch (error) {
    return { data: [], error };
  }
}
