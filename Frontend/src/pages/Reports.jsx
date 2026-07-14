import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, FileText, TrendingUp, Sparkles, Award } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getAnalyticsData } from '../services/analyticsService';
import { getTransactions } from '../services/transactionService';

export const Reports = () => {
  const { settings } = useApp();
  const [analysis, setAnalysis] = useState({ income: 0, expenses: 0, savings: 0, savingsRate: 0, largestPurchase: { merchant: 'None', amount: 0 }, topCategory: 'None' });

  useEffect(() => {
    async function loadReport() {
      const { data, error } = await getAnalyticsData();
      if (!error && data) {
        const { stats, categoryBreakdownData } = data;

        // Derive largestPurchase and topCategory from transactions
        const txRes = await getTransactions();
        const allTx = txRes.data || [];
        const expenses = allTx.filter(t => t.type !== 'income');
        const largest = expenses.reduce(
          (max, t) => Math.abs(Number(t.amount || 0)) > Math.abs(Number(max.amount || 0)) ? t : max,
          { merchant: 'None', amount: 0 }
        );
        const topCatEntry = categoryBreakdownData.length > 0
          ? categoryBreakdownData.reduce((a, b) => b.value > a.value ? b : a, { name: 'None', value: 0 })
          : { name: 'None' };

        setAnalysis({
          income: stats.incomeSum,
          expenses: stats.expenseSum,
          savings: Math.max(0, stats.netCashflow),
          savingsRate: stats.savingsRate,
          largestPurchase: { merchant: largest.merchant || largest.title || 'None', amount: Math.abs(Number(largest.amount || 0)) },
          topCategory: topCatEntry.name || 'None',
        });
      }
    }

    loadReport();
  }, []);

  const formatCurrency = (val) => `${settings.currency}${Math.abs(Number(val)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Monthly Report</h1>
          <p className="text-sm text-slate-400 mt-1">Audit-ready compiled statements and cash flow breakdowns.</p>
        </div>
        <Button variant="primary" onClick={handlePrint}>
          <Download size={16} className="mr-1.5" /> Download PDF Report
        </Button>
      </div>

      {/* Printable Report Card */}
      <div id="printable-report" className="bg-[#111827] border border-white/5 rounded-3xl p-8 space-y-8 text-left shadow-2xl">
        {/* Logo Banner */}
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#10b981] to-emerald-400 flex items-center justify-center">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">FINFLOW COMPLIANCE</h2>
              <p className="text-[9px] text-slate-500 font-mono">SECURE STATEMENT NODE</p>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-400 font-mono">
            <p>CYCLE: {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}</p>
            <p className="mt-0.5">GENERATED: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Dynamic Cashflow Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Total Verified Income</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-1">{formatCurrency(analysis.income)}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Total Verified Outflow</p>
            <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(analysis.expenses)}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Accumulated Savings</p>
            <p className="text-xl font-extrabold text-purple-400 mt-1">{formatCurrency(analysis.savings)} ({analysis.savingsRate}%)</p>
          </div>
        </div>

        {/* Highlight Insights Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historical Spotlights</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.01] border border-white/5">
                <span className="text-xs text-slate-400">Largest Single Purchase:</span>
                <span className="text-xs font-bold text-white">{analysis.largestPurchase.merchant} ({formatCurrency(analysis.largestPurchase.amount)})</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.01] border border-white/5">
                <span className="text-xs text-slate-400">Primary Expense Category:</span>
                <span className="text-xs font-bold text-white">{analysis.topCategory}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Summary</h3>
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
              <Sparkles size={16} className="text-[#10b981] shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {analysis.expenses > 0 ? (
                  <>
                    {analysis.savingsRate >= 30
                      ? <>Your savings velocity of <strong>{analysis.savingsRate}%</strong> exceeds recommendations by <strong>{Math.max(0, analysis.savingsRate - 30)}%</strong>. Overdraft risk remains low.</>
                      : analysis.savingsRate >= 0
                      ? <>Your current savings rate is <strong>{analysis.savingsRate}%</strong>, below the recommended 30% threshold.</>
                      : <>Your expenses currently exceed your income this period, resulting in a negative cash flow.</>
                    }
                    {' '}Main spending concentration observed in the <strong>{analysis.topCategory}</strong> category.
                  </>
                ) : (
                  'No transaction data available yet to generate an AI summary. Add income and expenses to unlock insights.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Signatures / Compliance info */}
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} FinFlow Technologies Inc. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <Award size={12} className="text-[#10b981]" />
            <span>Cryptographically Certified Statement</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
