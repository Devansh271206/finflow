import React, { useEffect, useState } from 'react';
import {
  LayoutGrid,
  UserCircle,
  Briefcase,
  CalendarDays,
  Wallet,
  Receipt,
  FileText,
  Bell,
  Settings as SettingsIcon,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { getMyOverview } from '../../services/essService';

import OverviewTab from './tabs/OverviewTab';
import MyProfileTab from './tabs/MyProfileTab';
import EmploymentTab from './tabs/EmploymentTab';
import MyLeaveTab from './tabs/MyLeaveTab';
import MyPayrollTab from './tabs/MyPayrollTab';
import MyExpensesTab from './tabs/MyExpensesTab';
import MyDocumentsTab from './tabs/MyDocumentsTab';
import NotificationsTab from './tabs/NotificationsTab';
import AccountSettingsTab from './tabs/AccountSettingsTab';

/**
 * Employee Self-Service (ESS) Portal — Sprint 13.
 * ------------------------------------------------------------------
 * Single page with tab navigation. This shell owns:
 *   - the active tab
 *   - the shared "overview" payload (employee record + snapshots)
 *     fetched once from GET /api/ess/overview and passed down so
 *     individual tabs don't all re-fetch the employee record.
 *
 * Each tab otherwise fetches its own detail data (full leave history,
 * full payroll history, etc.) using the existing service modules —
 * this shell does not duplicate that logic.
 */

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'profile', label: 'My Profile', icon: UserCircle },
  { key: 'employment', label: 'Employment', icon: Briefcase },
  { key: 'leave', label: 'Leave', icon: CalendarDays },
  { key: 'payroll', label: 'Payroll', icon: Wallet },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'settings', label: 'Account Settings', icon: SettingsIcon },
];

export function EmployeePortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getMyOverview();
    setOverview(data);
    setError(fetchError);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: fetchError } = await getMyOverview();
      if (!active) return;
      setOverview(data);
      setError(fetchError);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const employee = overview?.employee ?? null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          My Portal
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your profile, leave, payroll, expenses and documents in one place.
        </p>
      </div>

      {loading && (
        <Card>
          <Skeleton variant="rect" className="h-20" />
        </Card>
      )}

      {!loading && error && !employee && (
        <EmptyState
          icon={UserCircle}
          title="No employee record found"
          description={
            typeof error === 'string'
              ? error
              : error?.message || 'Your account isn\u2019t linked to an employee record yet. Contact your admin.'
          }
        />
      )}

      {!loading && employee && (
        <>
          {/* Tab navigation */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap
                    transition-all duration-200 border
                    ${isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-white/[0.02] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'}
                  `}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          <div>
            {activeTab === 'overview' && (
              <OverviewTab overview={overview} onRefresh={loadOverview} onNavigateTab={setActiveTab} />
            )}
            {activeTab === 'profile' && <MyProfileTab employee={employee} onSaved={loadOverview} />}
            {activeTab === 'employment' && <EmploymentTab employee={employee} employment={overview?.employment} />}
            {activeTab === 'leave' && <MyLeaveTab employee={employee} />}
            {activeTab === 'payroll' && <MyPayrollTab employee={employee} />}
            {activeTab === 'expenses' && <MyExpensesTab employee={employee} />}
            {activeTab === 'documents' && <MyDocumentsTab employee={employee} />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'settings' && <AccountSettingsTab onNavigateTab={setActiveTab} />}
          </div>
        </>
      )}
    </div>
  );
}

export default EmployeePortal;
