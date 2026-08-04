import React from 'react';
import Input from '../../../components/ui/Input';
import { Select, SelectItem } from '../../../components/ui/Select';

/**
 * Onboarding Step 1 — Organization Information
 * ------------------------------------------------------------------
 * Pure controlled leaf component. OnboardingWizard.jsx owns `value`
 * (the full org-info object) and `errors`; this only renders inputs
 * and calls onChange(field, newValue) — same controlled-child pattern
 * HolidayFormModal.jsx uses internally, just lifted one level up since
 * the wizard needs this state to survive across steps.
 */

const INDUSTRIES = [
  'Software / SaaS', 'IT Services', 'Fintech', 'Healthtech', 'Edtech',
  'E-commerce', 'Consulting', 'Other',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

// Small representative set rather than an exhaustive IANA list — this
// codebase has no existing timezone picker to defer to (checked:
// Settings.jsx stores timezone as free text), so a curated list keeps
// this shippable without pulling in a new dependency for one field.
const TIME_ZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London',
  'America/New_York', 'America/Los_Angeles', 'UTC',
];

const FINANCIAL_YEARS = ['April - March', 'January - December', 'July - June'];

export default function OrganizationInfoStep({ value, onChange, errors = {} }) {
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <div className="space-y-4">
      <Input
        label="Organization Name"
        placeholder="Acme Technologies"
        value={value.organization_name}
        onChange={set('organization_name')}
        error={errors.organization_name}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Industry</label>
          <Select value={value.industry} onChange={set('industry')}>
            <SelectItem value="">Select industry</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Company Size</label>
          <Select value={value.company_size} onChange={set('company_size')}>
            <SelectItem value="">Select size</SelectItem>
            {COMPANY_SIZES.map((s) => (
              <SelectItem key={s} value={s}>{s} employees</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <Input
        label="Country"
        placeholder="India"
        value={value.country}
        onChange={set('country')}
        error={errors.country}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Currency</label>
          <Select value={value.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Time Zone</label>
          <Select value={value.time_zone} onChange={set('time_zone')}>
            {TIME_ZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Financial Year</label>
        <Select value={value.financial_year} onChange={set('financial_year')}>
          {FINANCIAL_YEARS.map((fy) => (
            <SelectItem key={fy} value={fy}>{fy}</SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
}
