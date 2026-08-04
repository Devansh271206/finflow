import React from 'react';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSearch } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import Badge from '../ui/Badge';

const BADGE_VARIANT_BY_VALUE = {
  active: 'success',
  approved: 'success',
  paid: 'success',
  true: 'success',
  income: 'success',
  pending: 'warning',
  dept_approved: 'warning',
  on_leave: 'warning',
  rejected: 'danger',
  cancelled: 'danger',
  terminated: 'danger',
  false: 'default',
  inactive: 'default',
  expense: 'info',
};

function badgeVariantFor(value) {
  const key = String(value).toLowerCase();
  return BADGE_VARIANT_BY_VALUE[key] || 'default';
}

function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return '—';

  switch (type) {
    case 'currency':
      return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    case 'date': {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN');
    }
    case 'number':
      return Number(value).toLocaleString('en-IN');
    default:
      return String(value);
  }
}

/**
 * Report Table
 * ------------------------------------------------------------------
 * Generic, config-driven table used by every report (ReportViewer.jsx
 * passes it `columns` straight from the API response — see
 * reportRegistry.js's per-report `columns` array). Owns sorting and
 * pagination UI; the parent owns fetching (server-side sort/paginate
 * via reportService.getReportData(), not client-side over an
 * already-paginated page).
 */
export function ReportTable({
  columns = [],
  rows = [],
  loading = false,
  total = 0,
  page = 1,
  pageSize = 25,
  sortBy,
  sortOrder = 'asc',
  onSortChange,
  onPageChange,
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const handleHeaderClick = (columnKey) => {
    if (!onSortChange) return;
    if (sortBy === columnKey) {
      onSortChange(columnKey, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(columnKey, 'asc');
    }
  };

  if (loading) {
    return (
      <div className="bg-[#111827] border border-white/5 rounded-2xl p-5 space-y-3">
        <Skeleton className="h-5" count={1} />
        <Skeleton className="h-10" count={6} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No records found"
        description="No rows match the current filters. Try adjusting or clearing them."
      />
    );
  }

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col.key)}
                  className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:text-slate-300 transition-colors whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortBy === col.key &&
                      (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                {columns.map((col) => {
                  const value = row[col.key];
                  return (
                    <td key={col.key} className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {col.type === 'badge' ? (
                        value === null || value === undefined || value === '' ? (
                          '—'
                        ) : (
                          <Badge variant={badgeVariantFor(value)}>{String(value)}</Badge>
                        )
                      ) : (
                        formatCell(value, col.type)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-slate-500">
        <span>
          Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportTable;
