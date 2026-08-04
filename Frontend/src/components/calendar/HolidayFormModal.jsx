import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Select, SelectItem } from '../ui/Select';
import { createHoliday, updateHoliday, deleteHoliday } from '../../services/holidayService';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };

const EMPTY_FORM = {
  name: '',
  date: '',
  type: 'organization',
  description: '',
  is_recurring_annual: false,
};

/**
 * Holiday Form Modal
 * ------------------------------------------------------------------
 * Create/edit/delete a single holiday. Organization Admin only —
 * Calendar.jsx is responsible for not rendering the "Manage Holidays"
 * entry point at all for callers without holidays.manage, so this
 * modal doesn't re-check permissions itself (same trust boundary every
 * other *FormModal in this codebase relies on — the real enforcement
 * is server-side in holidayRoutes.js).
 *
 * `holiday` prop: null for create, a holiday object for edit. Calling
 * onSaved()/onDeleted() after a successful mutation lets Calendar.jsx
 * refetch the range without this modal needing to know how the parent
 * caches events.
 */
export default function HolidayFormModal({ isOpen, onClose, holiday, onSaved, onDeleted }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isEdit = Boolean(holiday);

  useEffect(() => {
    if (isOpen) {
      setForm(
        holiday
          ? {
              name: holiday.name || '',
              date: holiday.date || '',
              type: holiday.type || 'organization',
              description: holiday.description || '',
              is_recurring_annual: Boolean(holiday.is_recurring_annual),
            }
          : EMPTY_FORM
      );
      setErrors({});
      setDirty(false);
    }
  }, [isOpen, holiday]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setDirty(true);
  };

  const handleClose = () => {
    if (dirty && !window.confirm('Discard unsaved changes to this holiday?')) {
      return;
    }
    onClose();
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Holiday name is required';
    if (!form.date) next.date = 'Date is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      date: form.date,
      type: form.type,
      description: form.description.trim() || null,
      is_recurring_annual: form.is_recurring_annual,
    };

    const { data, error } = isEdit
      ? await updateHoliday(holiday.id, payload)
      : await createHoliday(payload);

    setSaving(false);

    if (error) {
      toast.error(error.message || 'Unable to save holiday.', { style: TOAST_STYLE });
      return;
    }

    toast.success(isEdit ? 'Holiday updated.' : 'Holiday created.', { style: TOAST_STYLE });
    setDirty(false);
    onSaved && onSaved(data);
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!window.confirm(`Delete "${holiday.name}"? This cannot be undone.`)) return;

    setDeleting(true);
    const { error } = await deleteHoliday(holiday.id);
    setDeleting(false);

    if (error) {
      toast.error(error.message || 'Unable to delete holiday.', { style: TOAST_STYLE });
      return;
    }

    toast.success('Holiday deleted.', { style: TOAST_STYLE });
    onDeleted && onDeleted(holiday.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEdit ? 'Edit Holiday' : 'Add Holiday'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Holiday Name"
          placeholder="Independence Day"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          error={errors.name}
        />

        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => updateField('date', e.target.value)}
          error={errors.date}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</label>
          <Select value={form.type} onChange={(e) => updateField('type', e.target.value)}>
            <SelectItem value="organization">Organization Holiday</SelectItem>
            <SelectItem value="public">Public Holiday</SelectItem>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Optional details visible on the calendar"
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none placeholder:text-slate-600 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30 transition-all duration-200 resize-none"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_recurring_annual}
            onChange={(e) => updateField('is_recurring_annual', e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#10b981]"
          />
          <span className="text-sm text-slate-300">Recurs every year on this date</span>
        </label>

        <div className="flex items-center justify-between pt-2">
          {isEdit ? (
            <Button type="button" variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              {isEdit ? 'Save Changes' : 'Create Holiday'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
