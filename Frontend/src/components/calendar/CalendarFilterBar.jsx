import React from 'react';
import { Search } from 'lucide-react';
import Input from '../ui/Input';

/**
 * Calendar Filter Bar
 * ------------------------------------------------------------------
 * Event-type toggle filters + search input for the enterprise
 * calendar. Follows ReportFilterPanel.jsx's controlled-values pattern:
 * the parent (Calendar.jsx) owns `activeTypes`/`search` state and
 * filters the events array client-side before passing it into
 * EnterpriseCalendar — this component only renders controls, it never
 * fetches or filters data itself.
 *
 * Type keys match the `type` field calendarAggregationService.js emits
 * on every event: approved_leave, pending_leave, public_holiday,
 * organization_holiday, weekend.
 */

const TYPE_OPTIONS = [
  { key: 'approved_leave', label: 'Approved Leave', color: '#10b981' },
  { key: 'pending_leave', label: 'Pending Leave', color: '#f59e0b' },
  { key: 'public_holiday', label: 'Public Holidays', color: '#ef4444' },
  { key: 'organization_holiday', label: 'Org Holidays', color: '#3b82f6' },
  { key: 'weekend', label: 'Weekends', color: '#6b7280' },
];

export default function CalendarFilterBar({ activeTypes, onActiveTypesChange, search, onSearchChange }) {
  const toggleType = (key) => {
    const next = new Set(activeTypes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onActiveTypesChange(next);
  };

  const allActive = activeTypes.size === TYPE_OPTIONS.length;

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[200px]">
        <Input
          icon={Search}
          placeholder="Search events..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onActiveTypesChange(allActive ? new Set() : new Set(TYPE_OPTIONS.map((t) => t.key)))}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            allActive
              ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
              : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          All
        </button>
        {TYPE_OPTIONS.map((opt) => {
          const active = activeTypes.has(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggleType(opt.key)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                active ? 'border-white/10 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
              style={active ? { boxShadow: `inset 0 0 0 1px ${opt.color}33` } : undefined}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color, opacity: active ? 1 : 0.4 }} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TYPE_OPTIONS };
