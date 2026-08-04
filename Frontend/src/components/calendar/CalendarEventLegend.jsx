import React from 'react';

/**
 * Calendar Event Legend
 * ------------------------------------------------------------------
 * Static legend matching Sprint 13's color scheme exactly:
 *   Green = Approved Leave, Yellow = Pending Leave, Red = Public Holiday,
 *   Blue = Organization Holiday, Purple = Company Event (future-ready —
 *   PRD explicitly scopes Company/Team Events as future-ready, not built
 *   this sprint, so it's shown here as a legend entry with no
 *   corresponding data source yet, same "documented but not wired"
 *   treatment Sprint 13's brief itself uses for that item), Gray = Weekend.
 *
 * Colors are intentionally hardcoded here to match
 * calendarAggregationService.js's LEAVE_STATUS_COLORS /
 * HOLIDAY_TYPE_COLORS / WEEKEND_COLOR constants — kept in sync manually
 * since this is a small, rarely-changing, purely-visual mapping and
 * introducing a shared constants module across the frontend/backend
 * boundary for six colors would be disproportionate.
 */

const LEGEND_ITEMS = [
  { label: 'Approved Leave', color: '#10b981' },
  { label: 'Pending Leave', color: '#f59e0b' },
  { label: 'Public Holiday', color: '#ef4444' },
  { label: 'Organization Holiday', color: '#3b82f6' },
  { label: 'Company Event', color: '#a855f7', comingSoon: true },
  { label: 'Weekend', color: '#6b7280' },
];

export default function CalendarEventLegend({ className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-slate-400">
            {item.label}
            {item.comingSoon && <span className="text-slate-600"> (soon)</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
