import React, { useEffect, useState } from 'react';
import { Receipt, Plus, Send } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Skeleton from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import { getTransactions, addTransaction, submitTransaction } from '../../../services/transactionService';

const STATUS_BADGE_VARIANT = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  reimbursed: 'success',
};

const STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed',
};

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

const EMPTY_FORM = { merchant: '', amount: '', date: '', notes: '' };

/**
 * My Expenses tab — reuses the existing Expense Approval Workflow
 * (transactions with type='expense' + approval_status). Sprint 4's
 * GET /api/transactions already scopes rows to the authenticated user
 * (transactionRepository.listForUser), so this tab is simply a
 * filtered, employee-facing view — no new backend logic.
 *
 * "Submit Expense Shortcut" creates a draft transaction and
 * immediately calls the existing submit endpoint, matching the
 * two-step draft -> submitted flow already used by
 * TransactionApprovalPanel.jsx elsewhere in the app.
 */
export function MyExpensesTab({ employee }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  async function loadExpenses() {
    setLoading(true);
    const { data } = await getTransactions({ type: 'expense' });
    setTransactions(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    loadExpenses();
  }, []);

  function openForm() {
    setFormData({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function handleSubmitExpense() {
    if (!formData.merchant.trim() || !formData.amount || !formData.date) {
      setFormError('Please fill in merchant, amount, and date.');
      return;
    }
    setSaving(true);
    setFormError(null);

    const { data: created, error: createError } = await addTransaction({
      merchant: formData.merchant.trim(),
      amount: Number(formData.amount),
      type: 'expense',
      paymentMethod: 'Reimbursement',
      date: formData.date,
      notes: formData.notes.trim(),
    });

    if (createError || !created) {
      setSaving(false);
      setFormError(
        typeof createError === 'string' ? createError : createError?.message || 'Failed to create expense'
      );
      return;
    }

    // Immediately submit it for approval rather than leaving it as a
    // draft — matches "Submit Expense Shortcut" from the PRD.
    await submitTransaction(created.id);

    setSaving(false);
    setIsFormOpen(false);
    loadExpenses();
  }

  const pendingCount = transactions.filter((t) =>
    ['submitted', 'under_review'].includes(t.approvalStatus)
  ).length;

  if (loading) {
    return <Skeleton variant="rect" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt size={16} className="text-slate-500" />
              My Expenses
            </h3>
            {pendingCount > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                {pendingCount} expense{pendingCount > 1 ? 's' : ''} awaiting approval
              </p>
            )}
          </div>
          <Button size="sm" onClick={openForm}>
            <Plus size={14} className="mr-1.5" />
            Submit Expense
          </Button>
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            description="Expenses you submit for reimbursement will show up here."
            actionText="Submit Expense"
            onAction={openForm}
          />
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{t.merchant}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(t.date)} · {t.category}
                    {t.notes ? ` · ${t.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">{formatCurrency(t.amount)}</span>
                  <Badge variant={STATUS_BADGE_VARIANT[t.approvalStatus] || 'default'}>
                    {STATUS_LABEL[t.approvalStatus] || 'Draft'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Submit Expense Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Submit Expense">
        <div className="space-y-4">
          <Input
            label="Merchant / Description"
            value={formData.merchant}
            onChange={(e) => setFormData((f) => ({ ...f, merchant: e.target.value }))}
            placeholder="e.g. Uber, Client Lunch"
          />
          <Input
            label="Amount"
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
          />
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Notes (optional)"
            value={formData.notes}
            onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Add any additional detail"
          />

          {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitExpense} loading={saving} disabled={saving}>
              <Send size={14} className="mr-1.5" />
              Submit for Approval
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default MyExpensesTab;
