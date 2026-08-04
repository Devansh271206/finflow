import React from 'react';
import { CheckCircle2, Loader2, XCircle, Building2, Users2, CalendarClock, Tags } from 'lucide-react';

/**
 * Onboarding Step 4 — Workspace Initialization
 * ------------------------------------------------------------------
 * Progress/summary screen shown while (and after) OnboardingWizard.jsx
 * calls onboardingService.completeOnboarding(). Renders a checklist
 * matching the sprint brief's Step 4 list:
 *   Organization, Workspace, Organization Admin Membership — implied
 *     by `status === 'success'` itself (if the call succeeded, these
 *     three exist; the backend has no partial-failure mode for them,
 *     see onboardingService.createOrganizationWorkspaceAndAdmin, which
 *     throws rather than partially completing).
 *   Default Departments / Default Teams — from summary.departments /
 *     summary.teamsSeeded.
 *   Default Employee Role — implied (roleRepository already seeds
 *     standard roles per workspace at workspace-creation time,
 *     confirmed via workspaceRepository's existing behavior; not a
 *     separate onboarding concern).
 *   Default Leave Types — summary.leaveTypesSeeded.
 *   Default Expense Categories / Default Budget Categories —
 *     summary.categoriesSeeded (see onboardingService.js's note on why
 *     these two share one seeding call).
 *   Default Dashboard Preferences — no backing table exists (see
 *     onboardingService.js); shown as informational only, not a
 *     pass/fail checklist item, so the UI doesn't claim to have done
 *     something that didn't actually happen.
 *
 * `status`: 'running' | 'success' | 'error'
 * `summary`: the onboardingService.completeOnboarding() response data
 *  (only present once status !== 'running')
 * `errorMessage`: present when status === 'error'
 */

function ChecklistItem({ icon: Icon, label, state, detail }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02]">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        {detail && <div className="text-xs text-slate-500 truncate">{detail}</div>}
      </div>
      {state === 'pending' && <Loader2 size={16} className="text-slate-500 animate-spin shrink-0" />}
      {state === 'done' && <CheckCircle2 size={16} className="text-[#10b981] shrink-0" />}
      {state === 'skipped' && <span className="text-[10px] text-slate-600 shrink-0">skipped</span>}
    </div>
  );
}

export default function WorkspaceInitStep({ status, summary, errorMessage }) {
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center text-center py-8 gap-3">
        <XCircle size={40} className="text-red-400" />
        <h3 className="text-base font-bold text-white">Setup couldn't finish</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          {errorMessage || 'Something went wrong while setting up your workspace. Please try again.'}
        </p>
      </div>
    );
  }

  const running = status === 'running';
  const step = (done) => (running ? 'pending' : done ? 'done' : 'skipped');

  return (
    <div className="space-y-5">
      {!running && (
        <div className="flex flex-col items-center text-center gap-2 pb-2">
          <CheckCircle2 size={36} className="text-[#10b981]" />
          <h3 className="text-base font-bold text-white">
            {summary?.workspace ? `${summary.company?.name || 'Your workspace'} is ready` : 'Setup complete'}
          </h3>
          <p className="text-sm text-slate-400">Here's what we set up for you.</p>
        </div>
      )}

      <div className="space-y-2">
        <ChecklistItem
          icon={Building2}
          label="Organization & Workspace"
          state={step(Boolean(summary?.workspace))}
          detail={summary?.company?.name}
        />
        <ChecklistItem
          icon={Users2}
          label="Default Departments & Teams"
          state={step(Boolean(summary?.departments?.length) && summary?.teamsSeeded)}
          detail={summary?.departments?.length ? summary.departments.map((d) => d.name).join(', ') : undefined}
        />
        <ChecklistItem
          icon={CalendarClock}
          label="Default Leave Types"
          state={step(Boolean(summary?.leaveTypesSeeded))}
        />
        <ChecklistItem
          icon={Tags}
          label="Default Categories & Budgets"
          state={step(Boolean(summary?.categoriesSeeded))}
        />
      </div>

      {!running && summary?.organizationSetup && !summary.organizationSetup.persisted && (
        <p className="text-xs text-slate-500 text-center pt-2">
          Your working days and policy preferences were saved to this session and can be finalized in Settings.
        </p>
      )}
    </div>
  );
}
