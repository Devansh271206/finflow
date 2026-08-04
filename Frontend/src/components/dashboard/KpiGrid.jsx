import React from 'react';
import StatCard from '../ui/StatCard';
import Skeleton from '../ui/Skeleton';

/**
 * Sprint 10 — Role-Based Dashboard System.
 *
 * Shared KPI grid used by every role dashboard page. Wraps the
 * existing StatCard component (no new stat-card UI introduced) in a
 * responsive grid, plus the loading/empty states every dashboard needs
 * in the same shape, so ExecutiveDashboard.jsx / FinanceDashboard.jsx /
 * etc. don't each re-implement their own grid + skeleton + empty-state
 * logic — this is the "no duplicate logic" piece for KPI display.
 *
 * `items` — array of { title, value, icon, trend, trendType, subtext,
 * iconBg, iconColor }, passed straight through to StatCard.
 * `loading` — renders `items.length || 4` skeleton cards instead.
 */
export default function KpiGrid({ items = [], loading = false, columns = 4 }) {
  const gridColsClass =
    {
      2: 'sm:grid-cols-2',
      3: 'sm:grid-cols-2 lg:grid-cols-3',
      4: 'sm:grid-cols-2 lg:grid-cols-4',
    }[columns] || 'sm:grid-cols-2 lg:grid-cols-4';

  if (loading) {
    const count = items.length || 4;
    return (
      <div className={`grid grid-cols-1 ${gridColsClass} gap-4`}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="h-28" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return null;
  }

  return (
    <div className={`grid grid-cols-1 ${gridColsClass} gap-4`}>
      {items.map((item, i) => (
        <StatCard
          key={item.title || i}
          title={item.title}
          value={item.value}
          icon={item.icon}
          trend={item.trend}
          trendType={item.trendType}
          subtext={item.subtext}
          iconBg={item.iconBg}
          iconColor={item.iconColor}
        />
      ))}
    </div>
  );
}
