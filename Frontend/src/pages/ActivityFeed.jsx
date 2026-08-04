import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Search, Building2, Users2, Calendar, Receipt, Wallet, Truck, CalendarDays, FileBarChart, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Select, SelectItem } from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import { getActivity } from '../services/activityService';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };
const PAGE_SIZE = 20;

const MODULE_FILTERS = [
  { value: '', label: 'All Modules' },
  { value: 'Leave', label: 'Leave' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Payroll', label: 'Payroll' },
  { value: 'Employee', label: 'Employee' },
  { value: 'Department', label: 'Department' },
  { value: 'Team', label: 'Team' },
  { value: 'Vendor', label: 'Vendor' },
  { value: 'Budget', label: 'Budget' },
  { value: 'Holiday', label: 'Holiday' },
  { value: 'Reports', label: 'Reports' },
  { value: 'Organization', label: 'Organization' },
];

const MODULE_ICON = {
  Leave: Calendar,
  Expense: Receipt,
  Payroll: Wallet,
  Employee: UserCog,
  Department: Building2,
  Team: Users2,
  Vendor: Truck,
  Budget: Wallet,
  Holiday: CalendarDays,
  Reports: FileBarChart,
  Organization: Building2,
};

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Activity Feed Page
 * ------------------------------------------------------------------
 * Sprint 14. Organization-wide activity timeline, role-scoped
 * server-side (Admin=all, Manager=dept/team, Employee=own — see
 * activityService.resolveActorScope). Same pagination convention as
 * NotificationCenter.jsx/Departments.jsx.
 *
 * KNOWN LIMITATION: activity_feed.actor_user_id is a raw auth.users id
 * with no profile join in activityRepository.js (that table has no
 * FK relationship exposed to a profiles/employees view the way
 * membershipRepository.attachProfile() does for memberships) — so
 * this page shows "System" for null actors and a shortened user id
 * for known ones, rather than a resolved display name. Resolving that
 * properly means either adding a profile lookup to
 * activityRepository.listForWorkspace() (an extra join/query per page)
 * or batching a separate profile-lookup call here; deferred as a
 * follow-up rather than guessing at a join that might not match this
 * schema's actual profiles table shape.
 */
export default function ActivityFeed() {
  const [activity, setActivity] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error, meta } = await getActivity({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      module: module || undefined,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Unable to load activity feed.', { style: TOAST_STYLE });
      return;
    }
    setActivity(data);
    setTotal(meta?.total ?? data.length);
  }, [page, search, module]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [search, module]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
          <Activity size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Activity Feed</h1>
          <p className="text-sm text-slate-400">Organization-wide visibility into what's happening</p>
        </div>
      </div>

      <Card glass className="p-4 md:p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <Input icon={Search} placeholder="Search activity..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-full sm:w-56">
          <Select value={module} onChange={(e) => setModule(e.target.value)}>
            {MODULE_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
        </div>
      </Card>

      <Card glass className="p-3 md:p-4">
        {loading ? (
          <div className="animate-pulse space-y-2 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity found"
            description={search || module ? 'Try adjusting your filters.' : 'Activity across your organization will appear here.'}
          />
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/5" />
            <div className="space-y-1">
              {activity.map((item) => {
                const Icon = MODULE_ICON[item.module] || Activity;
                return (
                  <div key={item.id} className="relative flex items-start gap-3 py-2.5">
                    <div className="absolute -left-6 top-3 w-2.5 h-2.5 rounded-full bg-[#10b981] ring-4 ring-[#0b1120]" />
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 shrink-0">
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{item.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.module} · {item.actor_user_id ? `User ${item.actor_user_id.slice(0, 8)}` : 'System'} · {timeAgo(item.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && activity.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/5">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} event{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
