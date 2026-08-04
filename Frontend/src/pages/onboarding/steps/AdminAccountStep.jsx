import React from 'react';
import { User, Mail, Lock } from 'lucide-react';
import Input from '../../../components/ui/Input';

/**
 * Onboarding Step 2 — Administrator Account
 * ------------------------------------------------------------------
 * UI-only leaf component, same controlled pattern as
 * OrganizationInfoStep.jsx. The actual account-creation call
 * (AppContext.register()) is deliberately NOT made here — it belongs
 * to OnboardingWizard.jsx, since that container is what needs to react
 * to the result (session vs. email-confirmation-required) before
 * deciding whether to advance to Step 4 or pause and explain next
 * steps to the user.
 *
 * "Automatically assign: Organization Admin role" (per the sprint
 * brief) happens server-side in onboardingService.js's
 * createOrganizationWorkspaceAndAdmin(), not here — this step only
 * collects the credentials.
 */
export default function AdminAccountStep({ value, onChange, errors = {} }) {
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <div className="space-y-4">
      <Input
        label="Full Name"
        icon={User}
        placeholder="Jordan Lee"
        value={value.full_name}
        onChange={set('full_name')}
        error={errors.full_name}
      />

      <Input
        label="Work Email"
        icon={Mail}
        type="email"
        placeholder="jordan@acme.com"
        value={value.email}
        onChange={set('email')}
        error={errors.email}
      />

      <Input
        label="Password"
        icon={Lock}
        type="password"
        placeholder="••••••••"
        value={value.password}
        onChange={set('password')}
        error={errors.password}
      />

      <Input
        label="Confirm Password"
        icon={Lock}
        type="password"
        placeholder="••••••••"
        value={value.confirm_password}
        onChange={set('confirm_password')}
        error={errors.confirm_password}
      />

      <p className="text-xs text-slate-500">
        This account will be created as the Organization Admin for your new workspace.
      </p>
    </div>
  );
}
