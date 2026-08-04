import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import { CHART_COLORS } from '../../config/reportConfig';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl p-3 shadow-xl text-left">
      <p className="text-xs font-semibold text-slate-400 mb-1">
        {point.name || point.payload?.name}
      </p>
      <p className="text-sm font-black" style={{ color: point.color || '#10b981' }}>
        {typeof point.value === 'number' ? point.value.toLocaleString('en-IN') : point.value}
      </p>
    </div>
  );
}

// Groups rows by chart.xKey and sums chart.yKey — the backend returns
// row-level data (already filtered/sorted), not pre-aggregated chart
// points, so this is the one piece of client-side aggregation needed
// to turn "rows" into "chart points". Kept generic (works for any
// xKey/yKey pair) rather than per-report, per the sprint's reusability
// goal.
function aggregateForChart(rows, xKey, yKey) {
  const totals = new Map();
  rows.forEach((row) => {
    const label = row[xKey] ?? 'Unknown';
    const value = Number(row[yKey]);
    const current = totals.get(label) || 0;
    totals.set(label, current + (Number.isNaN(value) ? 1 : value || 1));
  });
  return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
}

/**
 * Report Chart
 * ------------------------------------------------------------------
 * Renders the chart described by the backend's `chart` config
 * ({ type, xKey, yKey } from reportRegistry.js, or null for reports
 * with no chart e.g. Team Report). One generic component for all
 * chart types rather than a bespoke chart per report.
 */
export function ReportChart({ chart, rows = [], loading = false, title }) {
  const data = useMemo(() => {
    if (!chart || !rows.length) return [];
    return aggregateForChart(rows, chart.xKey, chart.yKey);
  }, [chart, rows]);

  if (!chart) return null;

  if (loading) {
    return (
      <Card hover={false} className="h-72">
        <Skeleton variant="rect" className="h-full" />
      </Card>
    );
  }

  if (!data.length) return null;

  return (
    <Card hover={false} className="h-72 flex flex-col">
      {title && (
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'pie' ? (
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
            </PieChart>
          ) : chart.type === 'line' ? (
            <LineChart data={data}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default ReportChart;
