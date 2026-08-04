import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, Building2, Power, PowerOff, Trash2, Users, Layers } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import StatCard from '../../components/ui/StatCard';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import {
  getOrganization,
  activateOrganization,
  suspendOrganization,
  deleteOrganization,
} from '../../services/platformAdminService';

/**
 * Organization Detail Page
 * ------------------------------------------------------------------
 * Single-org drill-down from Organizations.jsx's grid. Same
 * activate/suspend/delete actions as the list page, plus the org's
 * profile fields (industry, currency, timezone, country) that don't
 * fit on a summary card.
 */
export function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const loadOrg = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getOrganization(id);
    setLoading(false);

    if (error || !data) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setOrg(data);
  }, [id]);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  const handleToggleStatus = async () => {
    setActionPending(true);
    const action = org.status === 'active' ? suspendOrganization : activateOrganization;
    const { error } = await action(org.id);
    setActionPending(false);

    if (error) {
      toast.error(error.message || 'Action failed.');
      return;
    }
    toast.success(org.status === 'active' ? 'Organization suspended.' : 'Organization activated.');
    loadOrg();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${org.name}"? This cannot be undone from the UI.`)) return;
    setActionPending(true);
    const { error } = await deleteOrganization(org.id);
    setActionPending(false);

    if (error) {
      toast.error(error.message || 'Failed to delete organization.');
      return;
    }
    toast.success('Organization deleted.');
    navigate('/platform/organizations');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton variant="rect" className="h-28" count={3} />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <EmptyState
        title="Organization not found"
        description="This organization may have been deleted."
        actionText="Back to Organizations"
        onAction={() => navigate('/platform/organizations')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/platform/organizations"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Building2 size={20} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">{org.name}</h1>
              <Badge variant={org.status === 'active' ? 'success' : 'danger'}>{org.status}</Badge>
            </div>
            <p className="text-xs text-slate-500">{org.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" loading={actionPending} onClick={handleToggleStatus}>
            {org.status === 'active' ? (
              <>
                <PowerOff size={14} className="mr-1.5" /> Suspend
              </>
            ) : (
              <>
                <Power size={14} className="mr-1.5" /> Activate
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={actionPending}
            onClick={handleDelete}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} className="mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Workspaces" value={org.workspaceCount ?? 0} icon={Layers} iconBg="bg-indigo-500/10" iconColor="text-indigo-400" />
        <StatCard title="Employees" value={org.employeeCount ?? 0} icon={Users} iconBg="bg-violet-500/10" iconColor="text-violet-400" />
        <StatCard
          title="Created"
          value={org.created_at ? new Date(org.created_at).toLocaleDateString('en-IN') : '—'}
          icon={Building2}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
        />
      </div>

      <Card hover={false} className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Organization Profile</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-1">Industry</p>
            <p className="text-white font-medium">{org.industry || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Currency</p>
            <p className="text-white font-medium">{org.currency || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Timezone</p>
            <p className="text-white font-medium">{org.timezone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Country</p>
            <p className="text-white font-medium">{org.country || '—'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default OrganizationDetail;
