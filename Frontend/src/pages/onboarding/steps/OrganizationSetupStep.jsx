import React from 'react';
import Input from '../../../components/ui/Input';

/**
 * Onboarding Step 3 — Organization Setup
 * ------------------------------------------------------------------
 * Collects Working Days, Office Hours, Weekend Configuration, Default
 * Leave Policy, Default Expense Policy per the sprint brief.
 *
 * Honest scope note (also flagged in onboardingController.js): these
 * fields are sent to POST /api/onboarding/complete and echoed back
 * with organizationSetup.persisted: false — no confirmed `workspaces`
 * column exists yet to store them durably. This step still collects
 * them (so the wizard UX matches the brief exactly, and the values are
 * available to seed downstream config once that migration lands)
 * rather than silently omitting the step.
 *
 * value shape:
 * {
 *   working_days: string[] (e.g. ['mon','tue','wed','thu','fri']),
 *   office_hours: { start: 'HH:MM', end: 'HH:MM' },
 *   weekend_config: string[] (days NOT in working_days, auto-derived
 *     but independently editable in case an org's weekend doesn't
 *     exactly mirror "everything not a working day" — e.g. a
 *     4-day-week org with a mid-week off day),
 *   default_leave_policy: { annual_days: number },
 *   default_expense_policy: { approval_threshold: number },
 * }
 */

const ALL_DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

function DayToggleRow({ label, selected, onToggle }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {ALL_DAYS.map((d) => {
          const active = selected.includes(d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onToggle(d.key)}
              className={`text-xs font-semibold w-11 h-9 rounded-lg border transition-colors ${
                active
                  ? 'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981]'
                  : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function OrganizationSetupStep({ value, onChange, errors = {} }) {
  const toggleDay = (field) => (dayKey) => {
    const current = value[field] || [];
    const next = current.includes(dayKey)
      ? current.filter((d) => d !== dayKey)
      : [...current, dayKey];
    onChange(field, next);
  };

  const setOfficeHours = (edge) => (e) => {
    onChange('office_hours', { ...(value.office_hours || {}), [edge]: e.target.value });
  };

  const setLeavePolicy = (e) => {
    onChange('default_leave_policy', { annual_days: Number(e.target.value) || 0 });
  };

  const setExpensePolicy = (e) => {
    onChange('default_expense_policy', { approval_threshold: Number(e.target.value) || 0 });
  };

  return (
    <div className="space-y-6">
      <DayToggleRow label="Working Days" selected={value.working_days || []} onToggle={toggleDay('working_days')} />
      <DayToggleRow label="Weekend Days" selected={value.weekend_config || []} onToggle={toggleDay('weekend_config')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Office Hours — Start"
          type="time"
          value={value.office_hours?.start || ''}
          onChange={setOfficeHours('start')}
        />
        <Input
          label="Office Hours — End"
          type="time"
          value={value.office_hours?.end || ''}
          onChange={setOfficeHours('end')}
        />
      </div>

      <Input
        label="Default Annual Leave Days"
        type="number"
        min="0"
        placeholder="18"
        value={value.default_leave_policy?.annual_days ?? ''}
        onChange={setLeavePolicy}
        error={errors.default_leave_policy}
      />

      <Input
        label="Default Expense Approval Threshold"
        type="number"
        min="0"
        placeholder="5000"
        value={value.default_expense_policy?.approval_threshold ?? ''}
        onChange={setExpensePolicy}
        error={errors.default_expense_policy}
      />
      <p className="text-xs text-slate-500 -mt-3">
        Expenses above this amount will require manager approval. You can change this anytime in Settings.
      </p>
    </div>
  );
}
