import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { Calendar, Download, Sparkles, TrendingUp } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getAnalyticsData } from '../services/analyticsService';

export const Analytics = () => {
  const { settings } = useApp();
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [analyticsData, setAnalyticsData] = useState({
    stats: { incomeSum: 0, expenseSum: 0, netCashflow: 0, savingsRate: 0 },
    categoryBreakdownData: [],
    dailySpendingData: [],
    yearlyTrendData: [],
    incomeSourcesData: [],
    heatmapDays: [],
  });

  useEffect(() => {
    async function loadAnalytics() {
      const { data, error } = await getAnalyticsData();
      if (!error && data) {
        setAnalyticsData(data);
      }
    }

    loadAnalytics();
  }, []);

  const formatCurrency = (val) => `${settings.currency}${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const stats = analyticsData.stats;
  const categoryBreakdownData = analyticsData.categoryBreakdownData;
  const dailySpendingData = analyticsData.dailySpendingData;
  const yearlyTrendData = analyticsData.yearlyTrendData;
  const incomeSourcesData = analyticsData.incomeSourcesData;
  const heatmapDays = analyticsData.heatmapDays;

  const getHeatmapColor = (intensity) => {
    if (intensity === 0) return 'bg-white/5';
    if (intensity < 25) return 'bg-emerald-500/20';
    if (intensity < 50) return 'bg-emerald-500/40';
    if (intensity < 75) return 'bg-emerald-500/60';
    return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111827] border border-white/10 rounded-xl p-3 shadow-xl text-left">
          <p className="text-xs font-semibold text-slate-400 mb-1">
            {payload[0].name || payload[0].payload.name || payload[0].payload.day || payload[0].payload.month}
          </p>
          {payload.map((p, idx) => (
            <p key={idx} className="text-sm font-black" style={{ color: p.color || '#10b981' }}>
              {formatCurrency(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Financial Intelligence</h1>
          <p className="text-sm text-slate-400 mt-1">Deep audits, trends, yearly compounding projections, and cash flows.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              onClick={() => setSelectedTimeframe('30d')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedTimeframe === '30d' ? 'bg-[#10b981] text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              30 Days
            </button>
            <button
              onClick={() => setSelectedTimeframe('12m')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedTimeframe === '12m' ? 'bg-[#10b981] text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              12 Months
            </button>
          </div>
          <Button variant="secondary" className="h-[38px]">
            <Download size={14} className="mr-1.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Primary Analytics Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hover={false} className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historical Net Inflow</p>
            <h2 className="text-2xl font-black text-white mt-1">{formatCurrency(stats.netCashflow)}</h2>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <TrendingUp size={20} />
          </div>
        </Card>

        <Card hover={false} className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Savings Rate</p>
            <h2 className="text-2xl font-black text-white mt-1">{stats.savingsRate}%</h2>
          </div>
          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
            <Sparkles size={20} />
          </div>
        </Card>

        <Card hover={false} className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Flow Efficiency</p>
            <h2 className="text-2xl font-black text-white mt-1">
              {stats.savingsRate >= 30 ? 'Excellent' : stats.savingsRate >= 15 ? 'Good' : stats.netCashflow >= 0 ? 'Positive' : 'Negative'}
            </h2>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
            <Calendar size={20} />
          </div>
        </Card>
      </div>

      {/* Main Graph Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 1: Category Breakdown */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Category Allocations</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Graph 2: Daily Spending */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Daily Spending Velocity</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySpendingData}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} name="Billed Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Graph 3: Yearly Compounding Trend */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Yearly Net Worth Growth</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearlyTrendData}>
                <defs>
                  <linearGradient id="worthGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="netWorth" name="Capital Pool" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#worthGlow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Graph 4: Income Channels */}
        <Card hover={false} className="h-80 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Income Sources Distribution</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incomeSourcesData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={15}
                  dataKey="value"
                  label={({ name }) => name.split(' ')[0]}
                >
                  {incomeSourcesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Calendar Heatmap */}
      <Card hover={false}>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">
          Financial Activity Heatmap ({new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })})
        </h3>
        <div className="flex flex-wrap gap-2.5 items-center justify-start max-w-full overflow-x-auto pb-2">
          {heatmapDays.map((d) => (
            <div
              key={d.day}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold text-white/70 cursor-pointer hover:border hover:border-white/20 transition-all ${getHeatmapColor(d.intensity)}`}
              title={`Day ${d.day}: Intensity ${d.intensity}%`}
            >
              {d.day}
            </div>
          ))}
        </div>
        <div className="flex justify-end items-center gap-2 mt-4 text-[10px] font-bold text-slate-500">
          <span>Less Billed</span>
          <div className="w-3.5 h-3.5 rounded bg-white/5" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-500/20" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-500/40" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-500/60" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
          <span>More Billed</span>
        </div>
      </Card>
    </div>
  );
};

export default Analytics;
