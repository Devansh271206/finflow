import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useApp } from '../../context/AppContext';
import { completeOnboarding } from '../../services/onboardingService';
import OrganizationInfoStep from './steps/OrganizationInfoStep';
import AdminAccountStep from './steps/AdminAccountStep';
import OrganizationSetupStep from './steps/OrganizationSetupStep';
import WorkspaceInitStep from './steps/WorkspaceInitStep';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };

const STEPS = [
  { key: 'org_info', label: 'Organization' },
  { key: 'admin_account', label: 'Admin Account' },
  { key: 'org_setup', label: 'Setup' },
  { key: 'init', label: 'Finish' },
];

const INITIAL_ORG_INFO = {
  organization_name: '',
  industry: '',
  company_size: '',
  country: '',
  currency: 'INR',
  time_zone: 'Asia/Kolkata',
  financial_year: 'April - March',
};

const INITIAL_ADMIN_ACCOUNT = {
  full_name: '',
  email: '',
  password: '',
  confirm_password: '',
};

const INITIAL_ORG_SETUP = {
  working_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  weekend_config: ['sat', 'sun'],
  office_hours: { start: '09:30', end: '18:30' },
  default_leave_policy: { annual_days: 18 },
  default_expense_policy: { approval_threshold: 5000 },
};

/**
 * Onboarding Wizard
 * ------------------------------------------------------------------
 * Sprint 13, Part 1. Replaces the plain signup flow with the 4-step
 * wizard described in the sprint brief. Owns all cross-step state;
 * each step component is a pure controlled leaf (see steps/*.jsx).
 *
 * Step 2 -> Step 4 orchestration:
 *   1. Step 1+3 are collected locally first (no API calls — nothing to
 *      create until an account exists to own it, per
 *      onboardingController.js's header note).
 *   2. Step 2 submits by calling the EXISTING AppContext.register()
 *      (Supabase signUp) — not a new endpoint. This is deliberate: the
 *      sprint brief says "Replace the existing signup flow," not
 *      "build a second one," so Step 2 reuses the real account-creation
 *      path end to end.
 *   3. If register() returns a session (email confirmation disabled,
 *      the common case per Supabase project settings), we immediately
 *      call completeOnboarding() for Step 4.
 *   4. If register() does NOT return a session (email confirmation
 *      required), there is no authenticated request possible yet —
 *      completeOnboarding() would 401. Rather than silently losing
 *      Steps 1+3's data, it's cached in sessionStorage so it can be
 *      resumed once the user confirms their email and logs in for the
 *      first time. Wiring that resume point into Login.jsx is flagged
 *      as a follow-up, not implemented in this file, since Login.jsx
 *      wasn't part of this sprint's file list and changing its
 *      redirect behavior deserves its own reviewed change.
 *
 * Unsaved-changes warning: a beforeunload guard is active whenever the
 * user has entered any Step 1/2/3 data and hasn't finished Step 4 yet
 * — matches the sprint brief's "Unsaved Changes Warning" requirement
 * using the same lightweight approach as HolidayFormModal.jsx's
 * window.confirm (react-router v6 has no built-in in-app navigation
 * blocker without the data router API, which this app's
 * BrowserRouter setup in App.jsx doesn't use).
 */
export default function OnboardingWizard() {
  const { register } = useApp();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const [orgInfo, setOrgInfo] = useState(INITIAL_ORG_INFO);
  const [adminAccount, setAdminAccount] = useState(INITIAL_ADMIN_ACCOUNT);
  const [orgSetup, setOrgSetup] = useState(INITIAL_ORG_SETUP);
  const [errors, setErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [initStatus, setInitStatus] = useState(null); // null | 'running' | 'success' | 'error'
  const [initSummary, setInitSummary] = useState(null);
  const [initError, setInitError] = useState('');
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);

  const dirty = useMemo(
    () =>
      Boolean(orgInfo.organization_name || adminAccount.full_name || adminAccount.email) &&
      initStatus !== 'success',
    [orgInfo, adminAccount, initStatus]
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const updateOrgInfo = (field, val) => {
    setOrgInfo((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };
  const updateAdminAccount = (field, val) => {
    setAdminAccount((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };
  const updateOrgSetup = (field, val) => {
    setOrgSetup((prev) => ({ ...prev, [field]: val }));
  };

  const validateStep = (index) => {
    const next = {};
    if (index === 0 && !orgInfo.organization_name.trim()) {
      next.organization_name = 'Organization name is required';
    }
    if (index === 1) {
      if (!adminAccount.full_name.trim()) next.full_name = 'Full name is required';
      if (!adminAccount.email.trim()) next.email = 'Work email is required';
      if (!adminAccount.password) next.password = 'Password is required';
      if (adminAccount.password !== adminAccount.confirm_password) {
        next.confirm_password = 'Passwords do not match';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goBack = () => {
    if (stepIndex === 0) {
      if (dirty && !window.confirm('Leave onboarding? Your progress will be lost.')) return;
      navigate('/login');
      return;
    }
    setStepIndex((i) => i - 1);
  };

  const runInitialization = async () => {
    setInitStatus('running');
    const { data, error } = await completeOnboarding({
      organization_name: orgInfo.organization_name,
      industry: orgInfo.industry,
      company_size: orgInfo.company_size,
      country: orgInfo.country,
      currency: orgInfo.currency,
      time_zone: orgInfo.time_zone,
      financial_year: orgInfo.financial_year,
      working_days: orgSetup.working_days,
      office_hours: orgSetup.office_hours,
      weekend_config: orgSetup.weekend_config,
      default_leave_policy: orgSetup.default_leave_policy,
      default_expense_policy: orgSetup.default_expense_policy,
    });

    if (error) {
      setInitStatus('error');
      setInitError(error.message || 'Unable to finish setting up your workspace.');
      return;
    }

    setInitSummary(data);
    setInitStatus('success');
  };

  const handleNext = async () => {
    if (!validateStep(stepIndex)) return;

    // Step 2 -> Step 3: create the actual account here.
    if (stepIndex === 1) {
      setSubmitting(true);
      try {
        const result = await register(adminAccount.full_name, adminAccount.email, adminAccount.password);
        setSubmitting(false);

        if (!result?.session) {
          // Email confirmation required — no authenticated request is
          // possible yet. Cache Steps 1+3 for a later resume rather
          // than discarding them.
          try {
            sessionStorage.setItem(
              'finflow_pending_onboarding',
              JSON.stringify({ orgInfo, orgSetup })
            );
          } catch {
            // sessionStorage unavailable (e.g. private browsing) — not
            // fatal, the user can just re-enter Steps 1+3 after
            // confirming their email.
          }
          setPendingEmailConfirmation(true);
          setStepIndex(2);
          return;
        }
      } catch (err) {
        setSubmitting(false);
        setErrors({ email: err.message || 'Unable to create your account.' });
        toast.error(err.message || 'Unable to create your account.', { style: TOAST_STYLE });
        return;
      }
    }

    // Step 3 -> Step 4: kick off workspace initialization.
    if (stepIndex === 2 && !pendingEmailConfirmation) {
      setStepIndex(3);
      runInitialization();
      return;
    }

    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handleFinish = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px]" />

      <motion.div
        className="w-full max-w-lg relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#10b981]/15 flex items-center justify-center text-[#10b981]">
            <TrendingUp size={18} />
          </div>
          <span className="text-lg font-black text-white tracking-tight">FinFlow</span>
        </div>

        <Card glass className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      i < stepIndex
                        ? 'bg-[#10b981] border-[#10b981] text-white'
                        : i === stepIndex
                        ? 'border-[#10b981] text-[#10b981]'
                        : 'border-white/10 text-slate-500'
                    }`}
                  >
                    {i < stepIndex ? <Check size={14} /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-semibold ${i <= stepIndex ? 'text-slate-300' : 'text-slate-600'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded ${i < stepIndex ? 'bg-[#10b981]' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {stepIndex === 0 && <OrganizationInfoStep value={orgInfo} onChange={updateOrgInfo} errors={errors} />}
          {stepIndex === 1 && <AdminAccountStep value={adminAccount} onChange={updateAdminAccount} errors={errors} />}
          {stepIndex === 2 && pendingEmailConfirmation && (
            <div className="text-center py-8 space-y-2">
              <h3 className="text-base font-bold text-white">Check your inbox</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                We sent a confirmation link to {adminAccount.email}. Confirm your email, then log in to finish
                setting up {orgInfo.organization_name || 'your workspace'}.
              </p>
            </div>
          )}
          {stepIndex === 2 && !pendingEmailConfirmation && (
            <OrganizationSetupStep value={orgSetup} onChange={updateOrgSetup} errors={errors} />
          )}
          {stepIndex === 3 && (
            <WorkspaceInitStep status={initStatus} summary={initSummary} errorMessage={initError} />
          )}

          <div className="flex items-center justify-between mt-7">
            {stepIndex < 3 && !pendingEmailConfirmation ? (
              <>
                <Button variant="secondary" size="sm" onClick={goBack} disabled={submitting}>
                  Back
                </Button>
                <Button variant="primary" size="sm" onClick={handleNext} loading={submitting}>
                  {stepIndex === 1 ? 'Create Account' : 'Continue'}
                </Button>
              </>
            ) : stepIndex === 2 && pendingEmailConfirmation ? (
              <Button variant="primary" size="sm" className="w-full" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            ) : initStatus === 'error' ? (
              <Button variant="primary" size="sm" className="w-full" onClick={runInitialization}>
                Try Again
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={handleFinish}
                disabled={initStatus !== 'success'}
                loading={initStatus === 'running'}
              >
                Go to Dashboard
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
