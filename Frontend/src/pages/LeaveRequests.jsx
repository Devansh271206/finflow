import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, Search, Plus, XCircle, CalendarCheck, Clock, Ban, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import StatCard from '../components/ui/StatCard';
import LeaveCalendar from '../components/ui/LeaveCalendar';
import { Select, SelectItem } from '../components/ui/Select';
import { usePermissionContext } from '../context/PermissionContext';
import { useEmployeeContext } from '../context/EmployeeContext';
import { toLocalDateStr } from '../lib/dateUtils';
import {
  listLeaveTypes,
  getEmployeeBalances,
  listLeaveRequests,
  submitLeaveRequest,
  cancelLeaveRequest,
} from '../services/leaveService';

const PAGE_SIZE = 10;

const STATUS_LABELS = {
  pending: 'Pending',
  dept_approved: 'Dept Approved',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_VARIANTS = {
  pending: 'warning',
  dept_approved: 'info',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
};

const LeaveRequests = () => {
  const { can } = usePermissionContext() || {};
  const canManage = can ? can('leave.manage') : false;
  const canApprove = can ? can('leave.approve') : false;
  const canRead = can ? can('leave.read') : false;

  const { selfEmployee } = useEmployeeContext() || {};
  const employeeId = selfEmployee?.id;

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('submitted_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_period: 'AM',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  const [cancellingId, setCancellingId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refreshData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);

    const [typesRes, balancesRes, requestsRes] = await Promise.all([
      listLeaveTypes({ status: 'active' }),
      getEmployeeBalances(employeeId),
      listLeaveRequests({
        employee_id: employeeId,
        search: search || undefined,
        status: statusFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: PAGE_SIZE,
      }),
    ]);

    if (!typesRes.error && Array.isArray(typesRes.data)) {
      setLeaveTypes(typesRes.data);
    }
    if (!balancesRes.error && Array.isArray(balancesRes.data)) {
      setBalances(balancesRes.data);
    }
    if (!requestsRes.error && requestsRes.data) {
      setRequests(requestsRes.data.items || []);
      setTotal(requestsRes.data.total || 0);
    } else {
      setRequests([]);
      setTotal(0);
    }
    setLoading(false);
  }, [employeeId, search, statusFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshData();
    }, 300);
    return () => clearTimeout(timeout);
  }, [refreshData]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy, sortOrder]);

  const openCreate = () => {
    setFormData({
      leave_type_id: leaveTypes[0]?.id || '',
      start_date: '',
      end_date: '',
      is_half_day: false,
      half_day_period: 'AM',
      reason: '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !formData.leave_type_id || !formData.start_date || !formData.end_date) return;

    setSaving(true);
    const payload = {
      employee_id: employeeId,
      leave_type_id: formData.leave_type_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      is_half_day: formData.is_half_day,
      half_day_period: formData.is_half_day ? formData.half_day_period : undefined,
      reason: formData.reason.trim() || undefined,
    };
    const { error } = await submitLeaveRequest(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to submit leave request.');
      return;
    }

    toast.success('Leave request submitted!');
    setIsFormOpen(false);
    refreshData();
  };

  const handleCancel = async (id) => {
    const confirmed = window.confirm('Cancel this leave request?');
    if (!confirmed) return;

    setCancellingId(id);
    const { error } = await cancelLeaveRequest(id);
    setCancellingId(null);

    if (error) {
      toast.error(error.message || 'Failed to cancel leave request.');
      return;
    }

    toast.success('Leave request cancelled.');
    refreshData();
  };

  const canCancel = (status) => ['pending', 'dept_approved', 'approved'].includes(status);

  const calendarEvents = useMemo(() => {
    const evts = [];
    const activeStatuses = ['pending', 'dept_approved', 'approved'];
    (requests || []).forEach((req) => {
      if (!activeStatuses.includes(req.status)) return;
      const start = new Date(req.start_date + 'T00:00:00');
      const end = new Date(req.end_date + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = toLocalDateStr(d);
        evts.push({
          date: dateStr,
          status: req.status,
          label: req.leave_type?.name || 'Leave',
        });
      }
    });
    return evts;
  }, [requests]);

  const handleFormRangeSelect = (start, end) => {
    setFormData((f) => ({ ...f, start_date: start, end_date: end }));
  };

  const handleCalendarDateClick = (dateStr) => {
    if (!canManage || !employeeId) return;
    setFormData({
      leave_type_id: leaveTypes[0]?.id || '',
      start_date: dateStr,
      end_date: dateStr,
      is_half_day: false,
      half_day_period: 'AM',
      reason: '',
    });
    setIsFormOpen(true);
  };

  if (!canRead && !canManage) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Leave Requests</h1>
        <Card glass className="p-6">
          <p className="text-sm text-slate-400">You do not have permission to view leave requests.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Leave Requests</h1>
          <p className="text-sm text-slate-400 mt-1">
            Submit and manage your leave requests.
          </p>
        </div>
        {canManage && employeeId && (
          <Button variant="primary" size="md" onClick={openCreate}>
            <Plus size={16} className="mr-1.5" />
            New Leave Request
          </Button>
        )}
      </div>

      {employeeId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-24" />
            ))
          ) : balances.length === 0 ? (
            <div className="col-span-full">
              <Card glass className="p-4">
                <p className="text-xs text-slate-500">No leave balances found.</p>
              </Card>
            </div>
          ) : (
            balances.map((bal) => {
              const remaining = (bal.allocated_days || 0) + (bal.carried_forward_days || 0) - (bal.used_days || 0);
              return (
                <StatCard
                  key={bal.id}
                  label={bal.leave_type?.name || 'Leave'}
                  value={`${remaining} day${remaining !== 1 ? 's' : ''}`}
                  subtext={`${bal.used_days || 0} used of ${(bal.allocated_days || 0) + (bal.carried_forward_days || 0)}`}
                  icon={CalendarDays}
                  trend={remaining > 0 ? 'up' : 'down'}
                />
              );
            })
          )}
        </div>
      )}

      <Card glass className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leave Calendar</h3>
          {canManage && employeeId && (
            <span className="text-[10px] text-slate-500 italic">Click a date to apply</span>
          )}
        </div>
        <LeaveCalendar events={calendarEvents} mode="overview" onDateClick={handleCalendarDateClick} />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All Statuses" className="w-40">
          <SelectItem value="">All Statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="dept_approved">Dept Approved</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </Select>

        <Select
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split(':');
            setSortBy(by);
            setSortOrder(order);
          }}
          placeholder="Sort"
          className="w-44"
        >
          <SelectItem value="submitted_at:desc">Newest first</SelectItem>
          <SelectItem value="submitted_at:asc">Oldest first</SelectItem>
          <SelectItem value="start_date:asc">Start date (asc)</SelectItem>
          <SelectItem value="start_date:desc">Start date (desc)</SelectItem>
        </Select>
      </div>

      <Card glass className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="rect" className="h-16" count={4} />
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarDays}
              title="No leave requests yet"
              description="Submit a leave request to get started."
              actionText={canManage && employeeId ? 'New Leave Request' : undefined}
              onAction={canManage && employeeId ? openCreate : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                    <CalendarDays size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {req.leave_type?.name || 'Leave'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {new Date(req.start_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {req.start_date !== req.end_date
                        ? ` – ${new Date(req.end_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : ''}
                      {req.is_half_day ? ` (Half day – ${req.half_day_period})` : ''}
                      {req.reason ? ` · ${req.reason}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={STATUS_VARIANTS[req.status] || 'default'}>
                    {STATUS_LABELS[req.status] || req.status}
                  </Badge>

                  {canManage && canCancel(req.status) && (
                    <button
                      onClick={() => handleCancel(req.id)}
                      disabled={cancellingId === req.id}
                      className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      title="Cancel request"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && requests.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} · {total} request{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="New Leave Request" size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Leave Type</label>
            <Select
              value={formData.leave_type_id}
              onChange={(e) => setFormData((f) => ({ ...f, leave_type_id: e.target.value }))}
              placeholder="Select leave type"
            >
              {leaveTypes.map((lt) => (
                <SelectItem key={lt.id} value={lt.id}>
                  {lt.name}{lt.is_paid ? ' (Paid)' : ' (Unpaid)'}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Select Dates</label>
            <div className="bg-white/[0.02] rounded-xl border border-white/5 p-3">
              <LeaveCalendar
                selectedStart={formData.start_date}
                selectedEnd={formData.end_date}
                onRangeSelect={handleFormRangeSelect}
                events={calendarEvents}
                mode="range"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={formData.is_half_day}
                onChange={(e) => setFormData((f) => ({ ...f, is_half_day: e.target.checked }))}
                className="rounded border-white/20 bg-white/5 text-[#10b981] focus:ring-[#10b981]/30"
              />
              Half day
            </label>

            {formData.is_half_day && (
              <Select
                value={formData.half_day_period}
                onChange={(e) => setFormData((f) => ({ ...f, half_day_period: e.target.value }))}
                className="w-40"
              >
                <SelectItem value="AM">Morning</SelectItem>
                <SelectItem value="PM">Afternoon</SelectItem>
              </Select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Reason (optional)</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Brief description..."
              rows={3}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-xs py-3 px-4 outline-none focus:border-[#10b981]/50 transition-all duration-200 resize-none"
            />
          </div>

          <Button
            type="submit"
            className="w-full justify-center"
            loading={saving}
            disabled={saving || !formData.leave_type_id || !formData.start_date || !formData.end_date}
          >
            Submit Request
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default LeaveRequests;
