import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { toLocalDateStr, parseLocalDate } from '../../lib/dateUtils';
import EmptyState from '../ui/EmptyState';

/**
 * Enterprise Calendar
 * ------------------------------------------------------------------
 * Sprint 13, Part 2. Distinct from components/ui/LeaveCalendar.jsx,
 * which stays exactly as-is for its existing job (date-range picking
 * inside leave request forms) — this is a new, larger component for
 * the organization-wide calendar page.
 *
 * Consumes the flat event array calendarAggregationService.getEvents()
 * (backend) / calendarService.getEvents() (frontend, next file) return:
 *   { id, type, date, title, color, ...type-specific fields }
 * where type is one of: approved_leave, pending_leave, public_holiday,
 * organization_holiday, weekend.
 *
 * `view` controls month/week/day/agenda. Filtering (by event type) and
 * search are handled by the parent (CalendarFilterBar.jsx) — this
 * component only renders whatever `events` it's given, uses
 * dateUtils.js's toLocalDateStr/parseLocalDate for the same
 * timezone-safety reasons LeaveCalendar.jsx already documents.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export default function EnterpriseCalendar({
  events = [],
  view = 'month',
  onViewChange,
  onEventClick,
  onDateClick,
  loading = false,
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(today);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const todayStr = toLocalDateStr(today);

  const goPrev = () => {
    if (view === 'month') setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
    else if (view === 'week') setCursor((c) => addDays(c, -7));
    else setCursor((c) => addDays(c, -1));
  };

  const goNext = () => {
    if (view === 'month') setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
    else if (view === 'week') setCursor((c) => addDays(c, 7));
    else setCursor((c) => addDays(c, 1));
  };

  const goToday = () => setCursor(today);

  const headerLabel = useMemo(() => {
    if (view === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === 'week') {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      return sameMonth
        ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
        : `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    if (view === 'day') return `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    return 'Agenda';
  }, [view, cursor]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-white min-w-[180px] text-center">{headerLabel}</span>
          <button
            type="button"
            onClick={goNext}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-2 text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {['month', 'week', 'day', 'agenda'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange && onViewChange(v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md capitalize transition-colors ${
                view === v ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-white/5" />
          ))}
        </div>
      ) : view === 'month' ? (
        <MonthView
          cursor={cursor}
          todayStr={todayStr}
          eventsByDate={eventsByDate}
          onEventClick={onEventClick}
          onDateClick={onDateClick}
        />
      ) : view === 'week' ? (
        <WeekView
          cursor={cursor}
          todayStr={todayStr}
          eventsByDate={eventsByDate}
          onEventClick={onEventClick}
          onDateClick={onDateClick}
        />
      ) : view === 'day' ? (
        <DayView cursor={cursor} todayStr={todayStr} eventsByDate={eventsByDate} onEventClick={onEventClick} />
      ) : (
        <AgendaView events={events} onEventClick={onEventClick} />
      )}
    </div>
  );
}

function DayCell({ dateStr, isToday, isOutsideMonth, dayNumber, dayEvents, onDateClick, onEventClick, compact }) {
  return (
    <button
      type="button"
      onClick={() => onDateClick && onDateClick(dateStr)}
      className={`
        flex flex-col items-start text-left rounded-lg p-1.5 transition-colors border
        ${compact ? 'min-h-[80px]' : 'min-h-[110px]'}
        ${isOutsideMonth ? 'opacity-40 border-transparent' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}
      `}
    >
      <span
        className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
          isToday ? 'bg-[#10b981] text-white' : 'text-slate-400'
        }`}
      >
        {dayNumber}
      </span>
      <div className="flex flex-col gap-0.5 w-full">
        {dayEvents.slice(0, 3).map((ev) => (
          <span
            key={ev.id}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick && onEventClick(ev);
            }}
            title={ev.title}
            className="text-[10px] font-medium truncate w-full px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${ev.color}22`, color: ev.color }}
          >
            {ev.title}
          </span>
        ))}
        {dayEvents.length > 3 && (
          <span className="text-[10px] text-slate-500 px-1.5">+{dayEvents.length - 3} more</span>
        )}
      </div>
    </button>
  );
}

function MonthView({ cursor, todayStr, eventsByDate, onEventClick, onDateClick }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-[10px] font-semibold text-slate-500 text-center py-1.5 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const dateStr = toLocalDateStr(date);
          return (
            <DayCell
              key={dateStr}
              dateStr={dateStr}
              isToday={dateStr === todayStr}
              isOutsideMonth={date.getMonth() !== month}
              dayNumber={date.getDate()}
              dayEvents={eventsByDate[dateStr] || []}
              onDateClick={onDateClick}
              onEventClick={onEventClick}
            />
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, todayStr, eventsByDate, onEventClick, onDateClick }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((date) => {
        const dateStr = toLocalDateStr(date);
        return (
          <div key={dateStr} className="flex flex-col">
            <div className="text-center mb-1">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {DAYS[date.getDay()]}
              </div>
            </div>
            <DayCell
              dateStr={dateStr}
              isToday={dateStr === todayStr}
              isOutsideMonth={false}
              dayNumber={date.getDate()}
              dayEvents={eventsByDate[dateStr] || []}
              onDateClick={onDateClick}
              onEventClick={onEventClick}
              compact={false}
            />
          </div>
        );
      })}
    </div>
  );
}

function DayView({ cursor, todayStr, eventsByDate, onEventClick }) {
  const dateStr = toLocalDateStr(cursor);
  const dayEvents = eventsByDate[dateStr] || [];

  return (
    <div className="border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <CalendarIcon size={16} className="text-slate-500" />
        <span className={`text-sm font-bold ${dateStr === todayStr ? 'text-[#10b981]' : 'text-white'}`}>
          {MONTHS[cursor.getMonth()]} {cursor.getDate()}, {cursor.getFullYear()}
          {dateStr === todayStr ? ' (Today)' : ''}
        </span>
      </div>

      {dayEvents.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Nothing scheduled"
          description="No leave, holidays, or events on this day."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {dayEvents.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onEventClick && onEventClick(ev)}
              className="flex items-center gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors border border-white/5"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{ev.title}</div>
                {ev.description && <div className="text-xs text-slate-500 truncate">{ev.description}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AgendaView({ events, onEventClick }) {
  const grouped = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [events]);

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={CalendarIcon}
        title="No upcoming events"
        description="Leave, holidays, and weekends in this range will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(([dateStr, dayEvents]) => {
        const date = parseLocalDate(dateStr);
        return (
          <div key={dateStr}>
            <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              {date
                ? date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                : dateStr}
            </div>
            <div className="flex flex-col gap-1.5">
              {dayEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick && onEventClick(ev)}
                  className="flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors border border-white/5"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                  <span className="text-sm text-slate-200 truncate">{ev.title}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
