import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getPlatformDashboard } from '../../services/platformAdminService';
import PlatformAdminLayout from '../../layouts/PlatformAdminLayout';

/**
 * Platform Protected Route
 * ------------------------------------------------------------------
 * Mirrors App.jsx's existing `ProtectedRoute` (auth check -> layout
 * wrap) but adds the platform-admin gate on top, and wraps children in
 * PlatformAdminLayout instead of DashboardLayout — the two nav trees
 * must never mix (PRD: "Never mix Platform pages with Organization
 * pages").
 *
 * There is no `is_platform_admin` flag on the Supabase auth session
 * itself (AppContext.jsx's `user` is built purely from
 * session.user.user_metadata — see that file — and platform-admin
 * status lives in the `profiles` table instead, checked server-side by
 * requirePlatformAdmin middleware). Rather than adding a new profile
 * fetch just to read one boolean, this reuses the platform dashboard
 * call itself as the admin check: 200 means the caller passed
 * requirePlatformAdmin (so render the page with data already in hand),
 * 403/401/error means they didn't (redirect to the regular dashboard).
 */
export function PlatformProtectedRoute({ children }) {
  const { user, authReady } = useApp();
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (!authReady || !user?.isAuthenticated) {
      setChecking(false);
      return;
    }
    let active = true;
    getPlatformDashboard().then(({ error }) => {
      if (!active) return;
      setIsPlatformAdmin(!error);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [authReady, user?.isAuthenticated]);

  if (!authReady || checking) {
    return null;
  }

  if (!user?.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <PlatformAdminLayout>{children}</PlatformAdminLayout>;
}

export default PlatformProtectedRoute;
