import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function toDateStr(year, month, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(`${str}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function isSameOrBefore(a, b) {
  return a <= b;
}

function isSameOrAfter(a, b) {
  return a >= b;
}

const STATUS_DOT_COLORS = {
  pending: 'bg-amber-400',
  dept_approved: 'bg-blue-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-rose-400',
  cancelled: 'bg-slate-500',
};

export default function LeaveCalendar({
  selectedStart,
  selectedEnd,
  onRangeSelect,
  onDateClick,
  events = [],
  mode = 'range',
}) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [hoverDate, setHoverDate] = useState(null);

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const start = selectedStart ? parseDate(selectedStart) : null;
  const end = selectedEnd ? parseDate(selectedEnd) : null;
  const hover = hoverDate ? parseDate(hoverDate) : null;

  const selecting = start && !end;

  const eventsByDate = useMemo(() => {
    const map = {};
    (events || []).forEach((ev) => {
      const key = ev.date;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleDayClick = (day) => {
    const dateStr = toDateStr(currentYear, currentMonth, day);
    if (dateStr < todayStr) return; // no applying for leave in the past

    if (onDateClick) {
      onDateClick(dateStr);
    }

    if (mode !== 'range' || !onRangeSelect) return;

    if (!selectedStart || (selectedStart && selectedEnd)) {
      onRangeSelect(dateStr, '');
    } else {
      const s = parseDate(selectedStart);
      const d = parseDate(dateStr);
      if (d < s) {
        onRangeSelect(dateStr, selectedStart);
      } else {
        onRangeSelect(selectedStart, dateStr);
      }
    }
  };

  const handleDayHover = (day) => {
    if (!selecting) return;
    setHoverDate(toDateStr(currentYear, currentMonth, day));
  };

  const clearRange = () => {
    if (onRangeSelect) onRangeSelect('', '');
  };

  const isToday = (day) => {
    return currentYear === today.getFullYear() && currentMonth === today.getMonth() && day === today.getDate();
  };

  const isSelected = (day) => {
    const date = parseDate(toDateStr(currentYear, currentMonth, day));
    if (!date) return false;
    if (start && end && date >= start && date <= end) return true;
    if (start && !end && selecting && hover && date >= start && date <= hover) return true;
    if (start && !end && !selecting && date.getTime() === start.getTime()) return true;
    return false;
  };

  const isRangeBoundary = (day) => {
    const date = toDateStr(currentYear, currentMonth, day);
    return date === selectedStart || date === selectedEnd;
  };

  const dayEvents = (day) => {
    const dateStr = toDateStr(currentYear, currentMonth, day);
    return eventsByDate[dateStr] || [];
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-white">
          {MONTHS[currentMonth]} {currentYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-[10px] font-semibold text-slate-500 text-center py-1.5 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = toDateStr(currentYear, currentMonth, day);
          const isPast = dateStr < todayStr;
          const selected = isSelected(day);
          const boundary = isRangeBoundary(day);
          const todayMark = isToday(day);
          const evts = dayEvents(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => handleDayHover(day)}
              disabled={isPast}
              title={isPast ? 'Cannot select a past date' : undefined}
              className={`
                relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all duration-150 min-h-[36px]
                ${isPast
                  ? 'text-slate-600 opacity-40 cursor-not-allowed'
                  : selected && boundary
                    ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                    : selected
                      ? 'bg-[#10b981]/10 text-white'
                      : todayMark
                        ? 'text-[#10b981] font-bold'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <span>{day}</span>
              {evts.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {evts.slice(0, 5).map((ev, idx) => (
                    <span
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full ${ev.color ? '' : (STATUS_DOT_COLORS[ev.status] || 'bg-slate-500')}`}
                      style={ev.color ? { backgroundColor: ev.color } : {}}
                      title={ev.label || ''}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {mode === 'range' && selectedStart && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-white/5 pt-3">
          <span>
            {selectedStart && !selectedEnd
              ? `From: ${new Date(selectedStart + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – Select end date`
              : selectedStart && selectedEnd
                ? `${new Date(selectedStart + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(selectedEnd + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                : ''}
          </span>
          <button type="button" onClick={clearRange} className="text-slate-500 hover:text-white transition-colors">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
