import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getAIInsights } from '../services/analyticsService';
import { getTransactions } from '../services/transactionService';
import { getBudgets } from '../services/budgetService';

const iconMap = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  danger: AlertTriangle,
};

const colorMap = {
  warning: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/10' },
  info: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/10' },
  success: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/10' },
  danger: { icon: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/10' },
};

export const AIInsights = () => {
  const { user, settings } = useApp();
  const [insights, setInsights] = useState([]);
  const [summary, setSummary] = useState({ expenses: 0, topCategory: '', savingsRate: 0, projectedMonthEnd: 0 });
  const [loading, setLoading] = useState(true);

  const currency = settings?.currency || '₹';
  const displayName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    async function loadInsights() {
      const [insightsRes, txRes, budgetRes] = await Promise.all([
        getAIInsights(),
        getTransactions(),
        getBudgets(),
      ]);

      if (!insightsRes.error) setInsights(insightsRes.data || []);

      const transactions = txRes.data || [];
      const budgets = budgetRes.data || [];
      const expenses = transactions.filter(t => t.type !== 'income');
      const income = transactions.filter(t => t.type === 'income');
      const totalExpenses = expenses.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
      const totalIncome = income.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
      const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

      // Top category
      const catMap = new Map();
      expenses.forEach(t => {
        const cat = t.category || 'Uncategorized';
        catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(Number(t.amount || 0)));
      });
      const sortedCats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
      const topCategory = sortedCats[0]?.[0] || 'None';

      // Projected month end: extrapolate current spending rate
      const now = new Date();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const thisMonthExpenses = expenses.reduce((s, t) => {
        const d = new Date(t.transaction_date || t.created_at || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          ? s + Math.abs(Number(t.amount || 0))
          : s;
      }, 0);
      const projectedMonthEnd = dayOfMonth > 0 ? Math.round((thisMonthExpenses / dayOfMonth) * daysInMonth) : 0;

      setSummary({ expenses: totalExpenses, topCategory, savingsRate, projectedMonthEnd });
      setLoading(false);
    }

    loadInsights();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">AI Insights & Advice</h1>
          <p className="text-sm text-slate-400 mt-1">Automated scans auditing your spending patterns and savings opportunities.</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Insights List */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="text-slate-400 text-sm py-10 text-center">Analysing your financial data…</div>
          ) : insights.length === 0 ? (
            <Card hover={false}>
              <p className="text-slate-400 text-sm text-center py-8">No insights available yet. Add more transactions to unlock AI insights!</p>
            </Card>
          ) : insights.map(insight => {
            const Icon = iconMap[insight.type] || Info;
            const colors = colorMap[insight.type] || colorMap.info;

            return (
              <Card key={insight.id} hover={false} className={`border ${colors.border} bg-[#111827]`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${colors.bg} ${colors.icon} flex items-center justify-center shrink-0`}>
                    <Icon size={20} />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white leading-none">{insight.title}</h3>
                      <span className="text-[10px] font-bold text-slate-500">{insight.impact}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{insight.description}</p>
                    {insight.savingPotential && insight.savingPotential !== 'N/A' && (
                      <div className="pt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                        <Zap size={12} />
                        <span>Saving Potential: {insight.savingPotential}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card hover={false} className="border border-[#10b981]/20 bg-gradient-to-b from-[#111827] to-[#10b981]/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 text-[#10b981]/10">
              <Sparkles size={100} />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#10b981]" />
                <h3 className="text-sm font-extrabold text-white">FinFlow Coach</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                "{displayName}, your savings rate is currently **{summary.savingsRate}%**.
                {summary.savingsRate >= 30
                  ? " Excellent work — you're exceeding the recommended 30% target!"
                  : summary.savingsRate >= 15
                  ? ` Good progress! Aim to push above 30% by reducing ${summary.topCategory || 'discretionary'} spend.`
                  : ` Focus on reducing ${summary.topCategory || 'your largest'} expenses to boost savings.`}"
              </p>
              <div className="h-[1px] bg-white/5" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Coach Recommendations</p>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Review and consolidate recurring subscriptions</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Set a budget limit for your top category: {summary.topCategory || 'Uncategorized'}</span>
                </div>
              </div>
              <Button variant="primary" className="w-full text-xs font-bold justify-center mt-2" onClick={() => {}}>
                View All Budgets <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </div>
          </Card>

          {/* Predicted Month-End */}
          <Card hover={false}>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Predicted Month-End Expenses</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-white">
                  {currency}{summary.projectedMonthEnd.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
                {summary.expenses > 0 && (
                  <span className="text-xs font-bold text-slate-400">
                    {summary.savingsRate}% savings rate
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {summary.projectedMonthEnd > 0
                  ? `Based on your current spending pace this month.`
                  : `No spending data for this month yet.`}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
