import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import ReportFilterPanel from '../../components/reports/ReportFilterPanel';
import ReportTable from '../../components/reports/ReportTable';
import ReportSummaryCards from '../../components/reports/ReportSummaryCards';
import ReportChart from '../../components/reports/ReportChart';
import ExportButton from '../../components/reports/ExportButton';
import EmptyState from '../../components/ui/EmptyState';
import { getReportData } from '../../services/reportService';
import { getReportPresentation } from '../../config/reportConfig';

/**
 * Report Viewer
 * ------------------------------------------------------------------
 * ONE page for all 9 reports. Everything that varies between reports
 * (columns, filters, summary cards, chart) comes from the API response
 * (GET /api/reports/:reportId, driven by reportRegistry.js on the
 * backend) — this component only owns UI state (filters, sort, page)
 * and re-fetches when any of it changes.
 */
export function ReportViewer() {
  const { reportId } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFoundOrDenied, setNotFoundOrDenied] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const [sortBy, setSortBy] = useState(undefined);
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);

  const presentation = getReportPresentation(reportId);
  const Icon = presentation.icon;

  const queryParams = useMemo(
    () => ({
      ...filterValues,
      ...(sortBy ? { sortBy, sortOrder } : {}),
      page,
      pageSize: 25,
    }),
    [filterValues, sortBy, sortOrder, page]
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getReportData(reportId, queryParams);
    setLoading(false);

    if (error || !data) {
      setNotFoundOrDenied(true);
      return;
    }
    setNotFoundOrDenied(false);
    setReport(data);
  }, [reportId, queryParams]);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchReport]);

  // Reset pagination whenever the report id or filters change (not on
  // sort/page itself, to avoid an infinite loop) so switching reports
  // or filters doesn't strand the user on page 4 of a 1-row result.
  useEffect(() => {
    setPage(1);
  }, [reportId, filterValues]);

  // Derive select-filter option lists from the currently loaded page's
  // rows — reportRegistry.js's filters config doesn't ship a fixed
  // option list for workspace-specific values (status/department/etc.),
  // see ReportFilterPanel.jsx's header note.
  const selectOptions = useMemo(() => {
    if (!report) return {};
    const options = {};
    for (const filter of report.filters || []) {
      if (filter.type !== 'select') continue;
      const values = new Set();
      report.rows.forEach((row) => {
        const raw = row[filter.key];
        if (raw !== null && raw !== undefined && raw !== '') values.add(String(raw));
      });
      options[filter.key] = Array.from(values).sort();
    }
    return options;
  }, [report]);

  const handleSortChange = (key, direction) => {
    setSortBy(key);
    setSortOrder(direction);
  };

  if (notFoundOrDenied && !loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <EmptyState
          title="Report unavailable"
          description="Either this report doesn't exist, or you don't have permission to view it."
          actionText="Back to Reports"
          onAction={() => navigate('/reports')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/reports"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${presentation.color}1a`, color: presentation.color }}
          >
            <Icon size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
              {report?.label || 'Report'}
            </h1>
            <p className="text-xs text-slate-500">{report?.total ?? 0} records</p>
          </div>
        </div>
        <ExportButton reportId={reportId} filterParams={queryParams} disabled={loading} />
      </div>

      <ReportSummaryCards summary={report?.summary || []} loading={loading && !report} />

      {report?.chart && (
        <ReportChart chart={report.chart} rows={report.rows} loading={loading && !report} title="Breakdown" />
      )}

      <ReportFilterPanel
        filters={report?.filters || []}
        values={filterValues}
        onChange={setFilterValues}
        selectOptions={selectOptions}
      />

      <ReportTable
        columns={report?.columns || []}
        rows={report?.rows || []}
        loading={loading}
        total={report?.total || 0}
        page={report?.page || page}
        pageSize={report?.pageSize || 25}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        onPageChange={setPage}
      />
    </div>
  );
}

export default ReportViewer;
