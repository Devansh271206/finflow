import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, Search, CalendarDays, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import LeaveCalendar from '../components/ui/LeaveCalendar';
import { Select, SelectItem } from '../components/ui/Select';
import { usePermissionContext } from '../context/PermissionContext';
import { useDepartmentContext } from '../context/DepartmentContext';
import { toLocalDateStr } from '../lib/dateUtils';
import {
  listLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
} from '../services/leaveService';

const PAGE_SIZE = 15;

const STATUS_LABELS = {
  pending: 'Pending',
  dept_approved: 'Dept Approved',
};

const STATUS_VARIANTS = {
  pending: 'warning',
  dept_approved: 'info',
};

const LeaveApprovals = () => {
  const { can } = usePermissionContext() || {};
  const canApprove = can ? can('leave.approve') : false;
  const canRead = can ? can('leave.read') : false;

  const { activeDepartments } = useDepartmentContext() || {};

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const [approvingId, setApprovingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const calendarEvents = useMemo(() => {
    const evts = [];
    const employeeColors = {};
    let idx = 0;
    const palette = [
      '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
      '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#6366f1',
    ];
    (requests || []).forEach((req) => {
      const name = req.employee?.full_name || 'Unknown';
      if (!employeeColors[name]) {
        employeeColors[name] = palette[idx++ % palette.length];
      }
      const start = new Date(req.start_date + 'T00:00:00');
      const end = new Date(req.end_date + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        evts.push({
          date: toLocalDateStr(d),
          color: employeeColors[name],
          label: name,
        });
      }
    });
    return evts;
  }, [requests]);

  const refreshRequests = useCallback(async () => {
    setLoading(true);
    const params = {
      search: search || undefined,
      department_id: departmentFilter || undefined,
      status: statusFilter || undefined,
      sort_by: 'submitted_at',
      sort_order: 'asc',
      page,
      page_size: PAGE_SIZE,
    };
    const { data, error } = await listLeaveRequests(params);

    if (!error && data) {
      setRequests(data.items || []);
      setTotal(data.total || 0);
    } else {
      setRequests([]);
      setTotal(0);
    }
    setLoading(false);
  }, [search, departmentFilter, statusFilter, page]);

  useEffect(() => {
    const timeout = setTimeout(refreshRequests, 300);
    return () => clearTimeout(timeout);
  }, [refreshRequests]);

  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, statusFilter]);

  const handleApprove = async (id) => {
    setApprovingId(id);
    const { error } = await approveLeaveRequest(id);
    setApprovingId(null);

    if (error) {
      toast.error(error.message || 'Failed to approve request.');
      return;
    }

    toast.success('Leave request approved.');
    refreshRequests();
  };

  const openReject = (req) => {
    setRejectTarget(req);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejecting(true);
    const { error } = await rejectLeaveRequest(rejectTarget.id, rejectReason.trim());
    setRejecting(false);

    if (error) {
      toast.error(error.message || 'Failed to reject request.');
      return;
    }

    toast.success('Leave request rejected.');
    setRejectTarget(null);
    setRejectReason('');
    refreshRequests();
  };

  const formatDateRange = (req) => {
    const start = new Date(req.start_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (req.start_date === req.end_date) {
      return `${start}${req.is_half_day ? ` (Half day – ${req.half_day_period})` : ''}`;
    }
    const end = new Date(req.end_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${start} – ${end}`;
  };

  if (!canRead && !canApprove) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Leave Approvals</h1>
        <Card glass className="p-6">
          <p className="text-sm text-slate-400">You do not have permission to approve leave requests.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Leave Approvals</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and approve pending leave requests from your team.
          </p>
        </div>
      </div>

      <Card glass className="p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Team Leave Calendar</h3>
        <LeaveCalendar events={calendarEvents} mode="overview" />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by employee or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none transition-all duration-200"
          />
        </div>

        <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} placeholder="All Departments" className="w-48">
          <SelectItem value="">All Departments</SelectItem>
          {(activeDepartments || []).map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </Select>

        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Status" className="w-40">
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="dept_approved">Dept Approved</SelectItem>
          <SelectItem value="">All Active</SelectItem>
        </Select>
      </div>

      <Card glass className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="rect" className="h-16" count={5} />
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CheckCircle}
              title="No pending approvals"
              description="All leave requests have been reviewed."
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
                      {req.employee?.full_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {req.leave_type?.name || 'Leave'} · {formatDateRange(req)}
                      {req.reason ? ` · "${req.reason}"` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={STATUS_VARIANTS[req.status] || 'default'}>
                    {STATUS_LABELS[req.status] || req.status}
                  </Badge>

                  {canApprove && (
                    <>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={approvingId === req.id}
                        className="text-emerald-400 hover:text-emerald-300 p-2 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <CheckCircle size={18} />
                      </button>
                      <button
                        onClick={() => openReject(req)}
                        disabled={rejecting && rejectTarget?.id === req.id}
                        className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        <XCircle size={18} />
                      </button>
                    </>
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

      <Modal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Leave Request">
        <div className="space-y-4">
          {rejectTarget && (
            <div className="text-xs text-slate-400 space-y-1">
              <p><span className="text-slate-500">Employee:</span> {rejectTarget.employee?.full_name}</p>
              <p><span className="text-slate-500">Leave:</span> {rejectTarget.leave_type?.name} · {formatDateRange(rejectTarget)}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Reason for rejection</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Required – explain why this request is being rejected..."
              rows={3}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-xs py-3 px-4 outline-none focus:border-[#10b981]/50 transition-all duration-200 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setRejectTarget(null)} className="flex-1 justify-center">
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              loading={rejecting}
              disabled={rejecting || !rejectReason.trim()}
              className="flex-1 justify-center bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30"
            >
              Reject Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LeaveApprovals;
