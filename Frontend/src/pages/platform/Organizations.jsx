import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Building2, ChevronRight, Power, PowerOff, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Select, SelectItem } from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import {
  getOrganizations,
  createOrganization,
  activateOrganization,
  suspendOrganization,
  deleteOrganization,
} from '../../services/platformAdminService';

/**
 * Organizations Page
 * ------------------------------------------------------------------
 * The core of Platform Admin v1: list every org (with live status +
 * employee/workspace counts from GET /api/platform/organizations),
 * create new ones, and activate/suspend/delete existing ones.
 */
export function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [actionPendingId, setActionPendingId] = useState(null);

  const loadOrganizations = async () => {
    setLoading(true);
    const { data, error } = await getOrganizations(statusFilter || undefined);
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to load organizations.');
      return;
    }
    setOrganizations(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCreate = async () => {
    if (!newOrgName.trim()) {
      toast.error('Organization name is required.');
      return;
    }
    setCreating(true);
    const { error } = await createOrganization({ name: newOrgName.trim() });
    setCreating(false);

    if (error) {
      toast.error(error.message || 'Failed to create organization.');
      return;
    }
    toast.success('Organization created.');
    setNewOrgName('');
    setCreateOpen(false);
    loadOrganizations();
  };

  const handleToggleStatus = async (org) => {
    setActionPendingId(org.id);
    const action = org.status === 'active' ? suspendOrganization : activateOrganization;
    const { error } = await action(org.id);
    setActionPendingId(null);

    if (error) {
      toast.error(error.message || 'Action failed.');
      return;
    }
    toast.success(org.status === 'active' ? 'Organization suspended.' : 'Organization activated.');
    loadOrganizations();
  };

  const handleDelete = async (org) => {
    if (!window.confirm(`Delete "${org.name}"? This cannot be undone from the UI.`)) return;
    setActionPendingId(org.id);
    const { error } = await deleteOrganization(org.id);
    setActionPendingId(null);

    if (error) {
      toast.error(error.message || 'Failed to delete organization.');
      return;
    }
    toast.success('Organization deleted.');
    loadOrganizations();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Organizations</h1>
          <p className="text-sm text-slate-400 mt-1">{organizations.length} organizations on this platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All Statuses">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </Select>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-1.5" /> New Organization
          </Button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton variant="rect" className="h-24" count={4} />
        </div>
      )}

      {!loading && !organizations.length && (
        <EmptyState
          icon={Building2}
          title="No organizations found"
          description="No organizations match the current filter, or none have been created yet."
          actionText="New Organization"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {!loading && !!organizations.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organizations.map((org) => (
            <Card key={org.id} hover={false} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/platform/organizations/${org.id}`} className="flex items-center gap-3 min-w-0 group">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:underline">{org.name}</p>
                    <p className="text-xs text-slate-500 truncate">{org.slug}</p>
                  </div>
                </Link>
                <Badge variant={org.status === 'active' ? 'success' : 'danger'}>{org.status}</Badge>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>{org.workspaceCount ?? 0} workspaces</span>
                <span>{org.employeeCount ?? 0} employees</span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={actionPendingId === org.id}
                  onClick={() => handleToggleStatus(org)}
                >
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
                  loading={actionPendingId === org.id}
                  onClick={() => handleDelete(org)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} className="mr-1.5" /> Delete
                </Button>
                <Link to={`/platform/organizations/${org.id}`} className="ml-auto">
                  <Button variant="ghost" size="sm">
                    Details <ChevronRight size={14} className="ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Organization" size="sm">
        <div className="space-y-4">
          <Input
            label="Organization Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Acme Technologies"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Organizations;
