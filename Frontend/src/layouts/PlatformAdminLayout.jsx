import React from 'react';
import PlatformSidebar from '../components/platform/PlatformSidebar';

/**
 * Platform Admin Layout
 * ------------------------------------------------------------------
 * The platform-admin equivalent of DashboardLayout.jsx — deliberately
 * a separate, much simpler shell (no workspace switcher, no
 * notifications bell, no quick-add transaction modal — none of that
 * applies to a Platform Admin, who has no workspace). Kept to just
 * "sidebar + content" for v1, matching this sprint's "essential
 * functionality only" instruction.
 */
export function PlatformAdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#050816] text-white flex">
      <PlatformSidebar />
      <main className="flex-1 md:ml-64 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default PlatformAdminLayout;
