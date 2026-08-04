import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { usePermissionContext } from '../context/PermissionContext';
import EnterpriseCalendar from '../components/calendar/EnterpriseCalendar';
import CalendarEventLegend from '../components/calendar/CalendarEventLegend';
import CalendarFilterBar, { TYPE_OPTIONS } from '../components/calendar/CalendarFilterBar';
import HolidayFormModal from '../components/calendar/HolidayFormModal';
import { getCalendarEvents } from '../services/calendarService';
import { toLocalDateStr } from '../lib/dateUtils';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };

/**
 * Calendar Page
 * ------------------------------------------------------------------
 * Sprint 13, Part 2. The organization's central planning hub — merges
 * leave, holidays, and weekends into one view via
 * calendarService.getCalendarEvents() (backend's read-aggregation
 * layer, PRD §15.17).
 *
 * "Manage Holidays" (the + button and click-to-edit on holiday events)
 * is gated by can('holidays.manage') — UX-only gating per
 * usePermissions.js's own doc comment; the real enforcement is
 * holidayRoutes.js's authorize(PERMISSIONS.HOLIDAYS_MANAGE) middleware.
 * Everyone with holidays.read (granted broadly, migration 018) can
 * still view the full calendar.
 */

function getVisibleRange(view, cursor) {
  // Always fetches a full month window regardless of the active view,
  // so switching from month -> week -> day doesn't require a refetch —
  // EnterpriseCalendar filters what it renders, this just needs to
  // guarantee the data covers whatever the user might navigate to
  // within the current month.
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - start.getDay() - 7); // pad a week either side
  const end = new Date(year, month + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()) + 7);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
}

export default function Calendar() {
  const { can } = usePermissionContext() || {};
  const canManageHolidays = can ? can('holidays.manage') : false;

  const [view, setView] = useState('month');
  const [cursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTypes, setActiveTypes] = useState(new Set(TYPE_OPTIONS.map((t) => t.key)));
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { start, end } = getVisibleRange(view, cursor);
    const { data, error } = await getCalendarEvents({ start, end });
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Unable to load calendar events.', { style: TOAST_STYLE });
      return;
    }
    setEvents(data || []);
  }, [view, cursor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (!activeTypes.has(ev.type)) return false;
      if (term && !ev.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [events, activeTypes, search]);

  const handleEventClick = (ev) => {
    if (!canManageHolidays) return;
    if (ev.type === 'public_holiday' || ev.type === 'organization_holiday') {
      // occurrence_of maps a projected recurring instance back to its
      // source row id (see holidayService.projectRecurringHoliday) —
      // edits always act on the source holiday, not one occurrence.
      setEditingHoliday({ id: ev.occurrence_of || ev.id, name: ev.title, date: ev.date, type: ev.type === 'public_holiday' ? 'public' : 'organization', description: ev.description, is_recurring_annual: ev.isRecurring });
      setFormOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
            <CalendarDays size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Organization Calendar</h1>
            <p className="text-sm text-slate-400">Leave, holidays, and weekends in one place</p>
          </div>
        </div>

        {canManageHolidays && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingHoliday(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} className="mr-1.5" />
            Add Holiday
          </Button>
        )}
      </div>

      <CalendarFilterBar
        activeTypes={activeTypes}
        onActiveTypesChange={setActiveTypes}
        search={search}
        onSearchChange={setSearch}
      />

      <Card glass className="p-5">
        <EnterpriseCalendar
          events={filteredEvents}
          view={view}
          onViewChange={setView}
          onEventClick={handleEventClick}
          loading={loading}
        />
        <div className="mt-5 pt-4 border-t border-white/5">
          <CalendarEventLegend />
        </div>
      </Card>

      <HolidayFormModal
        isOpen={formOpen}
        holiday={editingHoliday}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          refresh();
        }}
        onDeleted={() => {
          setFormOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
