import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, XCircle, Users } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import { getPlatformDashboard } from '../../services/platformAdminService';

function GrowthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl p-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-black text-[#6366f1]">{payload[0].value} new organizations</p>
    </div>
  );
}

/**
 * Platform Dashboard
 * ------------------------------------------------------------------
 * Landing page for /platform. Renders GET /api/platform/dashboard as-is
 * (stats + growth) — see platformAdminService.js (backend) for what's
 * computed. No client-side aggregation needed here, unlike
 * ReportChart.jsx which had to bucket raw rows itself.
 */
export function PlatformDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPlatformDashboard().then(({ data }) => {
      if (!active) return;
      setDashboard(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const stats = dashboard?.stats;
  const growth = dashboard?.growth || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Platform Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Overview of every organization on FinFlow.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton variant="rect" className="h-28" count={4} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Organizations"
            value={stats?.totalOrganizations ?? 0}
            icon={Building2}
            iconBg="bg-indigo-500/10"
            iconColor="text-indigo-400"
          />
          <StatCard
            title="Active"
            value={stats?.activeOrganizations ?? 0}
            icon={CheckCircle2}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-400"
          />
          <StatCard
            title="Suspended"
            value={stats?.suspendedOrganizations ?? 0}
            icon={XCircle}
            iconBg="bg-red-500/10"
            iconColor="text-red-400"
          />
          <StatCard
            title="Total Employees (all orgs)"
            value={stats?.totalEmployees ?? 0}
            icon={Users}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-400"
          />
        </div>
      )}

      <Card hover={false} className="h-72 flex flex-col">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          New Organizations (Last 6 Months)
        </h3>
        <div className="flex-1 min-h-0">
          {loading ? (
            <Skeleton variant="rect" className="h-full" />
          ) : growth.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<GrowthTooltip />} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              No new organizations in this period.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default PlatformDashboard;
