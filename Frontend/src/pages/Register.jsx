import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Sprint 13: "Replace the existing signup flow" with the Enterprise
 * Organization Onboarding wizard (see pages/onboarding/OnboardingWizard.jsx).
 *
 * This file previously rendered a standalone Name/Email/Password form
 * that called AppContext.register() directly and sent the user to
 * /dashboard with no organization or workspace ever created — a gap
 * OnboardingWizard.jsx's Step 4 now closes. Rather than deleting the
 * /register route outright (which could break existing bookmarks/links
 * pointing at it), it's kept as a redirect into the real flow.
 */
export default function Register() {
  return <Navigate to="/onboarding" replace />;
}
