import React from 'react';
import { Hash, IndianRupee } from 'lucide-react';
import StatCard from '../ui/StatCard';
import Skeleton from '../ui/Skeleton';

function formatSummaryValue(value, type) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';

  switch (type) {
    case 'currency':
      return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    case 'number':
      return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
    default:
      return String(value);
  }
}

/**
 * Report Summary Cards
 * ------------------------------------------------------------------
 * Renders the `summary` array from GET /api/reports/:reportId, which
 * is computed server-side by reportService.computeSummary() over the
 * FILTERED (not just current-page) row set, per each report's
 * `summaryCards` config in reportRegistry.js. Reuses StatCard as-is —
 * no new card primitive needed.
 */
export function ReportSummaryCards({ summary = [], loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton variant="rect" className="h-28" count={summary.length || 2} />
      </div>
    );
  }

  if (!summary.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {summary.map((card) => (
        <StatCard
          key={card.key}
          title={card.label}
          value={formatSummaryValue(card.value, card.type)}
          icon={card.type === 'currency' ? IndianRupee : Hash}
          iconBg={card.type === 'currency' ? 'bg-emerald-500/10' : 'bg-indigo-500/10'}
          iconColor={card.type === 'currency' ? 'text-emerald-400' : 'text-indigo-400'}
        />
      ))}
    </div>
  );
}

export default ReportSummaryCards;
