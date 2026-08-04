import React, { useEffect, useState } from 'react';
import { CalendarDays, Plus, X as XIcon, Clock } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import { Select, SelectItem } from '../../../components/ui/Select';
import ProgressBar from '../../../components/ui/ProgressBar';
import Skeleton from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import {
  listLeaveTypes,
  getEmployeeBalances,
  listLeaveRequests,
  submitLeaveRequest,
  cancelLeaveRequest,
} from '../../../services/leaveService';

const STATUS_BADGE_VARIANT = {
  pending: 'warning',
  dept_approved: 'info',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
};

const PROGRESS_COLORS = ['emerald', 'blue', 'purple', 'amber', 'pink'];

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_FORM = {
  leave_type_id: '',
  start_date: '',
  end_date: '',
  is_half_day: false,
  half_day_period: 'AM',
  reason: '',
};

/**
 * My Leave tab — reuses the Sprint 9 Leave Management module entirely
 * (leaveService.js -> /api/leave-types, /api/leave-balances,
 * /api/leave-requests). This tab is a thinner, employee-scoped view
 * of the same data LeaveRequests.jsx already renders for HR/Admin —
 * no duplicate backend logic, just a self-scoped query
 * (`employee_id: employee.id`) and a lighter UI.
 */
export function MyLeaveTab({ employee }) {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  async function loadAll() {
    if (!employee?.id) return;
    setLoading(true);
    const [typesRes, balancesRes, requestsRes] = await Promise.all([
      listLeaveTypes({ status: 'active' }),
      getEmployeeBalances(employee.id),
      listLeaveRequests({ employee_id: employee.id, sort_by: 'submitted_at', sort_order: 'desc' }),
    ]);
    setLeaveTypes(Array.isArray(typesRes?.data) ? typesRes.data : []);
    setBalances(Array.isArray(balancesRes?.data) ? balancesRes.data : []);
    setRequests(Array.isArray(requestsRes?.data) ? requestsRes.data : []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  function openForm() {
    setFormData({ ...EMPTY_FORM, leave_type_id: leaveTypes[0]?.id || '' });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function handleSubmit() {
    if (!employee?.id || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setFormError('Please fill in leave type and both dates.');
      return;
    }
    setSaving(true);
    setFormError(null);

    const { error } = await submitLeaveRequest({
      employee_id: employee.id,
      leave_type_id: formData.leave_type_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      is_half_day: formData.is_half_day,
      half_day_period: formData.is_half_day ? formData.half_day_period : undefined,
      reason: formData.reason.trim() || undefined,
    });

    setSaving(false);

    if (error) {
      setFormError(typeof error === 'string' ? error : error?.message || 'Failed to submit leave request');
      return;
    }

    setIsFormOpen(false);
    loadAll();
  }

  async function handleCancel(id) {
    setCancellingId(id);
    await cancelLeaveRequest(id);
    setCancellingId(null);
    loadAll();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="rect" className="h-28" />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Leave Balance */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-500" />
          Leave Balance
        </h3>
        {balances.length === 0 ? (
          <p className="text-sm text-slate-500">No leave balances allocated yet.</p>
        ) : (
          <div className="space-y-5">
            {balances.map((b, i) => {
              const allocated = Number(b.allocated_days || 0) + Number(b.carried_forward_days || 0);
              const remaining = allocated - Number(b.used_days || 0);
              return (
                <div key={b.id || b.leave_type_id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-white">
                      {b.leave_type?.name || b.leave_type_name || 'Leave'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {remaining} / {allocated} days left
                    </span>
                  </div>
                  <ProgressBar value={remaining} max={allocated || 1} color={PROGRESS_COLORS[i % PROGRESS_COLORS.length]} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Leave History + Quick Apply */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            My Leave Requests
          </h3>
          <Button size="sm" onClick={openForm}>
            <Plus size={14} className="mr-1.5" />
            Apply for Leave
          </Button>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave requests yet"
            description="Your submitted leave requests will show up here."
            actionText="Apply for Leave"
            onAction={openForm}
          />
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {r.leave_type?.name || 'Leave'}
                    </span>
                    <Badge variant={STATUS_BADGE_VARIANT[r.status] || 'default'}>{r.status?.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    {r.is_half_day ? ` (Half day – ${r.half_day_period})` : ''}
                    {r.reason ? ` · ${r.reason}` : ''}
                  </p>
                </div>
                {(r.status === 'pending' || r.status === 'dept_approved') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancel(r.id)}
                    loading={cancellingId === r.id}
                    disabled={cancellingId === r.id}
                  >
                    <XIcon size={14} className="mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Apply Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Apply for Leave">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              Leave Type
            </label>
            <Select
              value={formData.leave_type_id}
              onChange={(e) => setFormData((f) => ({ ...f, leave_type_id: e.target.value }))}
              placeholder="Select leave type"
            >
              {leaveTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData((f) => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={formData.is_half_day}
              onChange={(e) => setFormData((f) => ({ ...f, is_half_day: e.target.checked }))}
              className="rounded border-white/20 bg-white/5"
            />
            Half day
          </label>

          {formData.is_half_day && (
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                Period
              </label>
              <Select
                value={formData.half_day_period}
                onChange={(e) => setFormData((f) => ({ ...f, half_day_period: e.target.value }))}
              >
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </Select>
            </div>
          )}

          <Input
            label="Reason (optional)"
            value={formData.reason}
            onChange={(e) => setFormData((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Add a note for your manager"
          />

          {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving} disabled={saving}>
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default MyLeaveTab;
