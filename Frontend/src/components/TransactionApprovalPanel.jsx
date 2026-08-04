import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Send, Wallet, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { usePermissionContext } from '../context/PermissionContext';
import {
  submitTransaction,
  approveTransaction,
  rejectTransaction,
  reimburseTransaction,
  getApprovalHistory,
} from '../services/transactionService';

const STATUS_BADGE = {
  draft: { label: 'Draft', variant: 'default' },
  submitted: { label: 'Awaiting Dept Lead', variant: 'warning' },
  under_review: { label: 'Awaiting Finance', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  reimbursed: { label: 'Reimbursed', variant: 'info' },
};

/**
 * Self-contained approval workflow panel for a single transaction.
 * Sprint 4. Renders the current status, whichever action(s) the caller
 * is allowed to take next (submit / approve / reject / reimburse), and
 * the full decision history behind the current status.
 *
 * NOTE: which action buttons render here is a UX convenience only —
 * per PermissionContext.jsx's own header comment, the real enforcement
 * is server-side (authorize() + approvalService.js's step/department
 * checks). A button showing here doesn't guarantee the action will
 * succeed; the backend has the final say.
 */
const TransactionApprovalPanel = ({ transaction, onUpdated }) => {
  const { can, role, departmentId } = usePermissionContext() || {};
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const status = transaction?.approvalStatus;
  const badge = STATUS_BADGE[status] || STATUS_BADGE.draft;

  const fetchHistory = useCallback(async () => {
    if (!transaction?.id) return;
    setLoadingHistory(true);
    const { data, error } = await getApprovalHistory(transaction.id);
    if (!error) setHistory(data || []);
    setLoadingHistory(false);
  }, [transaction?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const isAdmin = role?.key === 'ADMIN';
  const isFinance = role?.key === 'FINANCE';
  const isOwnDeptLead =
    role?.key === 'DEPARTMENT_LEAD' && departmentId && departmentId === transaction?.departmentId;

  const canSubmit = status === 'draft' && can && can('approvals.submit');
  const canActDeptLeadStep = status === 'submitted' && can && can('approvals.act') && (isAdmin || isOwnDeptLead);
  const canActFinanceStep = status === 'under_review' && can && can('approvals.act') && (isAdmin || isFinance);
  const canReimburse = status === 'approved' && can && can('approvals.act') && (isAdmin || isFinance);

  const runAction = async (fn, successMessage) => {
    setActionLoading(true);
    const { data, error } = await fn();
    setActionLoading(false);

    if (error) {
      toast.error(error.message || 'Action failed.');
      return;
    }

    toast.success(successMessage);
    setShowRejectInput(false);
    setRejectNotes('');
    fetchHistory();
    onUpdated?.(data);
  };

  const handleReject = () => {
    if (!rejectNotes.trim()) {
      toast.error('A reason is required to reject.');
      return;
    }
    runAction(() => rejectTransaction(transaction.id, rejectNotes), 'Transaction rejected.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {(canSubmit || canActDeptLeadStep || canActFinanceStep || canReimburse) && (
        <div className="flex flex-wrap items-center gap-2">
          {canSubmit && (
            <Button size="sm" onClick={() => runAction(() => submitTransaction(transaction.id), 'Submitted for approval.')} loading={actionLoading}>
              <Send size={14} className="mr-1.5" />
              Submit for Approval
            </Button>
          )}

          {(canActDeptLeadStep || canActFinanceStep) && !showRejectInput && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => runAction(() => approveTransaction(transaction.id), 'Approved.')}
                loading={actionLoading}
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowRejectInput(true)} disabled={actionLoading}>
                <XCircle size={14} className="mr-1.5" />
                Reject
              </Button>
            </>
          )}

          {canReimburse && (
            <Button
              size="sm"
              onClick={() => runAction(() => reimburseTransaction(transaction.id), 'Marked as reimbursed.')}
              loading={actionLoading}
            >
              <Wallet size={14} className="mr-1.5" />
              Mark Reimbursed
            </Button>
          )}
        </div>
      )}

      {showRejectInput && (
        <div className="space-y-2">
          <textarea
            className="w-full text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200 placeholder:text-slate-500"
            rows={2}
            placeholder="Reason for rejection (required)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleReject} loading={actionLoading}>
              Confirm Reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(false)} disabled={actionLoading}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
          <Clock size={12} />
          Decision History
        </p>
        {loadingHistory ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-500">No decisions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="text-xs text-slate-400 flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${h.decision === 'approved' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <div>
                  <span className="text-slate-300 font-medium">
                    {h.step === 'dept_lead' ? 'Dept Lead' : 'Finance'} {h.decision}
                  </span>
                  {h.notes ? ` — ${h.notes}` : ''}
                  <span className="text-slate-500"> · {new Date(h.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionApprovalPanel;
