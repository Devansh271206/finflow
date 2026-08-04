import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import { getPlatformAnalytics } from '../../services/platformAdminService';

const STATUS_COLORS = { Active: '#10b981', Suspended: '#ef4444' };

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl p-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-black text-[#6366f1]">{payload[0].value} new organizations</p>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl p-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-400 mb-1">{point.name}</p>
      <p className="text-sm font-black" style={{ color: point.payload.fill }}>
        {point.value}
      </p>
    </div>
  );
}

/**
 * Platform Analytics
 * ------------------------------------------------------------------
 * v1 scope, matching platformAdminService.js (backend)'s
 * getPlatformAnalytics(): a longer (12-month) org growth trend plus
 * the active/suspended status split already available from the
 * dashboard stats. No cohort/retention/usage analytics yet — see the
 * backend service's header comment for why that's deliberately out of
 * scope for this sprint.
 */
export function PlatformAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPlatformAnalytics().then(({ data: analytics }) => {
      if (!active) return;
      setData(analytics);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const growth = data?.growth || [];
  const stats = data?.stats;
  const statusBreakdown = stats
    ? [
        { name: 'Active', value: stats.activeOrganizations },
        { name: 'Suspended', value: stats.suspendedOrganizations },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Platform Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Organization growth and status breakdown across the platform.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card hover={false} className="lg:col-span-2 h-80 flex flex-col">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Organization Growth (Last 12 Months)
          </h3>
          <div className="flex-1 min-h-0">
            {loading ? (
              <Skeleton variant="rect" className="h-full" />
            ) : growth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growth}>
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<LineTooltip />} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No signups in this period.
              </div>
            )}
          </div>
        </Card>

        <Card hover={false} className="h-80 flex flex-col">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Status Breakdown</h3>
          <div className="flex-1 min-h-0">
            {loading ? (
              <Skeleton variant="rect" className="h-full" />
            ) : statusBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <BarChart3 size={24} className="text-slate-600" />
                No organizations yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default PlatformAnalytics;
