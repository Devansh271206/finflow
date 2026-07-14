import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  Target,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import ProgressBar from '../components/ui/ProgressBar';
import { getDashboardData } from '../services/dashboardService';
import { getBudgets } from '../services/budgetService';
import { getGoals } from '../services/goalService';
import { getBills } from '../services/billService';

const CATEGORY_COLORS = {
  emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b',
  purple: '#a855f7', rose: '#f43f5e', pink: '#ec4899',
  teal: '#14b8a6', orange: '#f97316', cyan: '#06b6d4',
};

function getColorHex(colorName) {
  return CATEGORY_COLORS[colorName] || '#6366f1';
}

const CustomTooltip = ({ active, payload, currency = '₹' }) => {
  if (active && payload && payload.length) {
    const label =
      payload[0].payload?.name ||
      payload[0].payload?.week ||
      payload[0].payload?.month ||
      payload[0].name;
    return (
      <div className="bg-[#111827] border border-white/10 rounded-xl p-3 shadow-xl text-left">
        <p className="text-xs font-semibold text-slate-400 mb-1">{label}</p>
        {payload.map((p, idx) => (
          <p key={idx} className="text-sm font-black" style={{ color: p.color || '#10b981' }}>
            {currency}{Number(p.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const Dashboard = () => {
  const { settings, user } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const currency = settings?.currency || '₹';
  const formatCurrency = useCallback(
    (val) => `${currency}${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
    [currency]
  );

  // Load all dashboard data in parallel
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [txRes, budgetsRes, goalsRes, billsRes] = await Promise.all([
      getDashboardData(),
      getBudgets(),
      getGoals(),
      getBills(),
    ]);
    setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
    setBudgets(Array.isArray(budgetsRes.data) ? budgetsRes.data : []);
    setGoals(Array.isArray(goalsRes.data) ? goalsRes.data : []);
    setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Derived financial stats
  const stats = useMemo(() => {
    const income = transactions.reduce(
      (sum, tx) => sum + (tx.type === 'income' ? Math.abs(Number(tx.amount || 0)) : 0), 0
    );
    const expenses = transactions.reduce(
      (sum, tx) => sum + (tx.type !== 'income' ? Math.abs(Number(tx.amount || 0)) : 0), 0
    );
    const balance = income - expenses;
    const cashFlow = income - expenses;

    const totalBudgetLimit = budgets.reduce((sum, b) => sum + Number(b.limit || 0), 0);
    const totalBudgetSpent = budgets.reduce((sum, b) => sum + Number(b.spent || 0), 0);
    const budgetUtilization = totalBudgetLimit > 0 ? (totalBudgetSpent / totalBudgetLimit) * 100 : 0;
    const savingsRate = income > 0 ? (cashFlow / income) * 100 : 0;

    let healthScore = 60;
    if (savingsRate > 20) healthScore += 10;
    if (savingsRate > 30) healthScore += 10;
    if (budgetUtilization < 80) healthScore += 10;
    if (budgetUtilization < 60) healthScore += 10;
    if (budgetUtilization > 95) healthScore -= 20;
    if (transactions.length > 5) healthScore += 5;
    healthScore = Math.min(100, Math.max(10, Math.round(healthScore)));

    return {
      balance,
      income,
      expenses,
      cashFlow,
      healthScore,
      budgetUtilization: Math.round(budgetUtilization),
      savingsRate: Math.round(savingsRate),
    };
  }, [transactions, budgets]);

  // Category pie chart from live budget spent data
  const categoryChartData = useMemo(() => {
    const validBudgets = budgets.filter(b => b.spent > 0);
    if (validBudgets.length === 0) {
      // Fallback: derive from transactions
      const catMap = new Map();
      transactions
        .filter(tx => tx.type !== 'income')
        .forEach(tx => {
          const cat = tx.category || 'Uncategorized';
          catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(Number(tx.amount || 0)));
        });
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#f43f5e', '#ec4899'];
      return Array.from(catMap.entries()).slice(0, 6).map(([name, value], idx) => ({
        name,
        value: Math.round(value),
        color: colors[idx % colors.length],
      }));
    }
    return validBudgets.map(b => ({
      name: b.category,
      value: Math.round(b.spent),
      color: getColorHex(b.color),
    }));
  }, [budgets, transactions]);

  // Income vs Expense last 6 months
  const incomeVsExpenseData = useMemo(() => {
    const monthMap = new Map();
    transactions.forEach(tx => {
      const dateValue = tx.transaction_date || tx.created_at || tx.date;
      const date = dateValue ? new Date(dateValue) : null;
      if (!date || isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = monthMap.get(key) || {
        name: date.toLocaleString('en-IN', { month: 'short' }),
        income: 0,
        expenses: 0,
      };
      if (tx.type === 'income') {
        existing.income += Math.abs(Number(tx.amount || 0));
      } else {
        existing.expenses += Math.abs(Number(tx.amount || 0));
      }
      monthMap.set(key, existing);
    });

    return Array.from({ length: 6 }, (_, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - idx));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = monthMap.get(key) || {
        name: d.toLocaleString('en-IN', { month: 'short' }),
        income: 0,
        expenses: 0,
      };
      return { name: existing.name, income: Math.round(existing.income), expenses: Math.round(existing.expenses) };
    });
  }, [transactions]);

  // Weekly spending (current month)
  const weeklySpendingData = useMemo(() => {
    const weekMap = new Map([
      ['Week 1', 0], ['Week 2', 0], ['Week 3', 0], ['Week 4', 0],
    ]);
    const now = new Date();
    transactions
      .filter(tx => tx.type !== 'income')
      .forEach(tx => {
        const dateValue = tx.transaction_date || tx.created_at || tx.date;
        const date = dateValue ? new Date(dateValue) : null;
        if (!date || isNaN(date.getTime())) return;
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return;
        const weekKey = `Week ${Math.min(4, Math.floor((date.getDate() - 1) / 7) + 1)}`;
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + Math.abs(Number(tx.amount || 0)));
      });
    return Array.from(weekMap.entries()).map(([week, amount]) => ({ week, amount: Math.round(amount) }));
  }, [transactions]);

  // Savings growth (running total per month)
  const savingsGrowthData = useMemo(() => {
    let running = 0;
    return incomeVsExpenseData.map(entry => {
      running += entry.income - entry.expenses;
      return { month: entry.name, savings: Math.round(running) };
    });
  }, [incomeVsExpenseData]);

  // Cash flow trend
  const cashFlowTrendData = useMemo(() =>
    incomeVsExpenseData.map(entry => ({
      month: entry.name,
      flow: Math.round(entry.income - entry.expenses),
    })),
    [incomeVsExpenseData]
  );

  // Latest 5 transactions
  const latestTransactions = useMemo(() =>
    [...transactions]
      .sort((a, b) => {
        const da = new Date(a.transaction_date || a.created_at || a.date || 0);
        const db = new Date(b.transaction_date || b.created_at || b.date || 0);
        return db - da;
      })
      .slice(0, 5)
      .map(tx => ({
        ...tx,
        logoText: (tx.merchant || tx.title || 'T').charAt(0).toUpperCase(),
        logoBg: tx.type === 'income' ? 'bg-emerald-600' : 'bg-slate-700',
      })),
    [transactions]
  );

  const now = new Date();
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const displayName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* Welcome Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Financial Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">Hello, {displayName}. Here is your automated wealth intelligence overview.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 self-start md:self-auto">
          <Calendar size={14} className="text-[#10b981]" />
          <span>Real-time Sync: {monthLabel}</span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Current Net Assets"
          value={formatCurrency(stats.balance)}
          trend={stats.cashFlow >= 0 ? 'Positive' : 'Negative'}
          trendType={stats.cashFlow >= 0 ? 'up' : 'down'}
          subtext="income minus expenses"
          icon={DollarSign}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Total Income"
          value={formatCurrency(stats.income)}
          trend={`${stats.savingsRate}% saved`}
          trendType="up"
          subtext="all-time income tracked"
          icon={ArrowUpRight}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Total Outflow"
          value={formatCurrency(stats.expenses)}
          trend={stats.budgetUtilization > 90 ? 'Over budget' : 'On track'}
          trendType={stats.budgetUtilization > 90 ? 'down' : 'up'}
          subtext="all-time expenses tracked"
          icon={ArrowDownRight}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
        />
        <StatCard
          title="Net Cash Flow"
          value={formatCurrency(stats.cashFlow)}
          trend={stats.cashFlow >= 0 ? 'Surplus' : 'Deficit'}
          trendType={stats.cashFlow >= 0 ? 'up' : 'down'}
          subtext="income minus spending"
          icon={ShieldCheck}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10"
        />
      </div>

      {/* Health Score + Budget + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col justify-between" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Financial Health Score</span>
            <Sparkles size={16} className="text-[#10b981]" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-4xl font-extrabold text-white">{stats.healthScore}</h3>
            <span className="text-sm font-semibold text-[#10b981]">/ 100</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            {stats.healthScore >= 80
              ? 'Excellent financial discipline. Keep up the great work!'
              : stats.healthScore >= 60
              ? 'Good standing. Consider increasing your savings rate.'
              : 'Room for improvement — review your spending habits.'}
          </p>
          <ProgressBar value={stats.healthScore} color="emerald" />
        </Card>

        <Card className="flex flex-col justify-between" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Budget Utilization</span>
            <span className="text-xs font-semibold text-rose-400">{stats.budgetUtilization}%</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-4xl font-extrabold text-white">
              {formatCurrency(budgets.reduce((acc, b) => acc + (b.spent || 0), 0))}
            </h3>
            <span className="text-xs text-slate-500">
              spent of {formatCurrency(budgets.reduce((acc, b) => acc + (b.limit || 0), 0))} limit
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            {budgets.length === 0
              ? 'No budgets configured yet.'
              : `You have spent ${stats.budgetUtilization}% of your combined budget limits.`}
          </p>
          <ProgressBar value={stats.budgetUtilization} color={stats.budgetUtilization > 90 ? 'rose' : stats.budgetUtilization > 75 ? 'amber' : 'emerald'} />
        </Card>

        <Card className="flex flex-col justify-between" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Savings Goals</span>
            <Target size={16} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-4xl font-extrabold text-white">
              {goals.filter(g => g.current >= g.target).length}
            </h3>
            <span className="text-xs text-slate-500">completed / {goals.length} total goals</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            {goals.length === 0
              ? 'No savings goals created yet.'
              : `Total target: ${formatCurrency(goals.reduce((a, g) => a + (g.target || 0), 0))}. Saved: ${formatCurrency(goals.reduce((a, g) => a + (g.current || 0), 0))}.`}
          </p>
          <ProgressBar
            value={goals.reduce((a, g) => a + (g.current || 0), 0)}
            max={goals.reduce((a, g) => a + (g.target || 0), 0) || 1}
            color="blue"
          />
        </Card>
      </div>

      {/* Analytics Charts */}
      <h2 className="text-lg font-bold text-white tracking-tight pt-4">Analytics Visualization</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Income vs Expense */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Income vs Expense History</h3>
          <div className="flex-1 min-h-0 w-full">
            {incomeVsExpenseData.some(d => d.income > 0 || d.expenses > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incomeVsExpenseData}>
                  <defs>
                    <linearGradient id="incomeGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip currency={currency} />} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#incomeGlow)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#expenseGlow)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">No transaction data yet</div>
            )}
          </div>
        </Card>

        {/* Category Breakdown */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Expense Categories</h3>
          <div className="flex-1 min-h-0 w-full relative flex items-center justify-center">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip currency={currency} />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-xs">No spending data yet</div>
            )}
            {categoryChartData.length > 0 && (
              <div className="absolute flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total Spent</span>
                <span className="text-base font-extrabold text-white">{formatCurrency(stats.expenses)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Weekly Spending */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Weekly Spending</h3>
          <div className="flex-1 min-h-0 w-full">
            {weeklySpendingData.some(d => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySpendingData}>
                  <XAxis dataKey="week" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip currency={currency} />} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Spending">
                    {weeklySpendingData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === weeklySpendingData.length - 1 ? '#10b981' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">No spending this month</div>
            )}
          </div>
        </Card>

        {/* Savings Growth */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Savings Growth Trend</h3>
          <div className="flex-1 min-h-0 w-full">
            {savingsGrowthData.some(d => d.savings !== 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={savingsGrowthData}>
                  <defs>
                    <linearGradient id="savingsGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip currency={currency} />} />
                  <Area type="monotone" dataKey="savings" name="Saved Funds" stroke="#a855f7" strokeWidth={2.5} fillOpacity={1} fill="url(#savingsGlow)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">Add transactions to see savings growth</div>
            )}
          </div>
        </Card>

        {/* Cash Flow */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Monthly Net Cash Flow</h3>
          <div className="flex-1 min-h-0 w-full">
            {cashFlowTrendData.some(d => d.flow !== 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowTrendData}>
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip currency={currency} />} />
                  <Bar dataKey="flow" fill="#10b981" radius={[6, 6, 0, 0]} name="Cash Flow">
                    {cashFlowTrendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.flow >= 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">No data yet</div>
            )}
          </div>
        </Card>

        {/* Budget Limits vs Spent */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Budget Limits vs Spent</h3>
          <div className="flex-1 min-h-0 w-full">
            {budgets.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgets} layout="vertical">
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip currency={currency} />} />
                  <Bar dataKey="limit" fill="#1f2937" radius={[0, 4, 4, 0]} name="Limit" />
                  <Bar dataKey="spent" fill="#10b981" radius={[0, 4, 4, 0]} name="Spent" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">No budgets configured</div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Transactions + Bills + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Recent Transactions */}
        <Card hover={false} className="lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white tracking-tight">Recent Transactions</h3>
            <Link to="/transactions" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-4">
            {loading && transactions.length === 0 ? (
              <div className="text-sm text-slate-400">Loading transactions…</div>
            ) : latestTransactions.length > 0 ? latestTransactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold ${tx.logoBg} text-white`}>
                    {tx.logoText}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{tx.merchant || tx.title}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {tx.category} • {tx.transaction_date || tx.date || ''}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-extrabold ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {tx.type === 'income' ? '+' : ''}{formatCurrency(Math.abs(Number(tx.amount || 0)))}
                </span>
              </div>
            )) : (
              <div className="text-sm text-slate-400 py-4 text-center">No transactions yet. Add your first one!</div>
            )}
          </div>
        </Card>

        {/* Right: Bills + Goals */}
        <div className="space-y-6">
          {/* Upcoming Bills */}
          <Card hover={false}>
            <h3 className="text-sm font-bold text-white tracking-tight mb-5">Upcoming Bills</h3>
            <div className="space-y-4">
              {bills.length > 0 ? bills.slice(0, 3).map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">{bill.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Due {bill.dueDate}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-white">{formatCurrency(bill.amount)}</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">{bill.autoPay ? 'Autopay Enabled' : 'Manual Pay'}</p>
                  </div>
                </div>
              )) : (
                <div className="text-xs text-slate-400 text-center py-4">No upcoming bills</div>
              )}
            </div>
          </Card>

          {/* Savings Goals */}
          <Card hover={false}>
            <h3 className="text-sm font-bold text-white tracking-tight mb-5">Savings Goals</h3>
            <div className="space-y-4">
              {goals.length > 0 ? goals.slice(0, 2).map(goal => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{goal.name}</span>
                    <span className="text-slate-400">{formatCurrency(goal.current)} / {formatCurrency(goal.target)}</span>
                  </div>
                  <ProgressBar value={goal.current} max={goal.target || 1} color="blue" />
                </div>
              )) : (
                <div className="text-xs text-slate-400 text-center py-4">No goals set yet</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
