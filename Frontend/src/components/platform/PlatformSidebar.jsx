import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, BarChart3, Settings as SettingsIcon, LogOut, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const NAV_ITEMS = [
  { path: '/platform', label: 'Platform Dashboard', icon: LayoutDashboard, end: true },
  { path: '/platform/organizations', label: 'Organizations', icon: Building2 },
  { path: '/platform/analytics', label: 'Platform Analytics', icon: BarChart3 },
  { path: '/platform/settings', label: 'Platform Settings', icon: SettingsIcon },
];

/**
 * Platform Sidebar
 * ------------------------------------------------------------------
 * A deliberately separate nav component, not a mode/prop on the
 * existing DashboardLayout sidebar — per PRD "Never mix Platform pages
 * with Organization pages," and so a future Platform-only nav item
 * (billing, feature flags, monitoring) can be added here without
 * touching org-admin nav logic at all, or vice versa.
 *
 * Visually distinguished with an indigo/violet accent (vs. the
 * org-admin shell's emerald) so it's immediately obvious which mode
 * you're in even before reading any page content — same dark shell
 * (#050816/#111827) for a consistent product feel, different accent
 * so Platform Admin never looks like "just another workspace".
 */
export function PlatformSidebar() {
  const { logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex flex-col fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#111827] border-r border-white/5">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-[#6366f1]/15 flex items-center justify-center">
          <ShieldCheck size={18} className="text-[#6366f1]" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-white leading-tight">FinFlow</p>
          <p className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider leading-tight">
            Platform Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `
                relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group
                ${isActive
                  ? 'text-white bg-[#6366f1]/10 border border-[#6366f1]/20 shadow-[inset_0_0_12px_rgba(99,102,241,0.08)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-[#6366f1]' : 'text-slate-400 group-hover:text-white'} />
                  {isActive && (
                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#6366f1] rounded-r-full" />
                  )}
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/5">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </aside>
  );
}

export default PlatformSidebar;
