import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { getAvailableReports } from '../../services/reportService';
import { getReportPresentation, getGroupLabel } from '../../config/reportConfig';

/**
 * Reports Hub
 * ------------------------------------------------------------------
 * Landing page for Sprint 11 reporting — GET /api/reports already
 * returns only the reports the current role/workspace is permitted to
 * view (reportService.listAvailableReports() on the backend checks
 * each report's permission before including it), so this page never
 * needs its own RBAC logic — it just renders whatever comes back.
 */
export function ReportsHub() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data } = await getAvailableReports();
      if (active) {
        setReports(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map();
    reports.forEach((report) => {
      const label = getGroupLabel(report.module);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(report);
    });
    return Array.from(groups.entries());
  }, [reports]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Reports</h1>
        <p className="text-sm text-slate-400 mt-1">
          Generate, filter and export reports across your workspace.
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton variant="rect" className="h-24" count={6} />
        </div>
      )}

      {!loading && !reports.length && (
        <EmptyState
          icon={LayoutGrid}
          title="No reports available"
          description="You don't have permission to view any reports yet. Contact your workspace admin if you believe this is a mistake."
        />
      )}

      {!loading &&
        grouped.map(([groupLabel, groupReports]) => (
          <div key={groupLabel} className="space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{groupLabel}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupReports.map((report) => {
                const presentation = getReportPresentation(report.id);
                const Icon = presentation.icon;
                return (
                  <Link key={report.id} to={`/reports/${report.id}`}>
                    <Card className="flex items-center justify-between gap-3 h-full">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${presentation.color}1a`, color: presentation.color }}
                        >
                          <Icon size={18} />
                        </div>
                        <span className="text-sm font-semibold text-white truncate">{report.label}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 shrink-0" />
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

export default ReportsHub;
