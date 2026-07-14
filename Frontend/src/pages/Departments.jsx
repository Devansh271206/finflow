import React, { useState } from 'react';
import { Building2, Plus, Pencil, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { usePermissionContext } from '../context/PermissionContext';
import { useDepartmentContext } from '../context/DepartmentContext';
import {
  createDepartment,
  updateDepartment,
} from '../services/departmentService';

const Departments = () => {
  const { can } = usePermissionContext() || {};
  const canManage = can ? can('departments.manage') : false;
  const { departments, loading, refreshDepartments } = useDepartmentContext() || {};

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState(null); // department object or null
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  const openAdd = () => {
    setNewName('');
    setIsAddOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    const { error } = await createDepartment(newName.trim());
    setCreating(false);

    if (error) {
      toast.error(error.message || 'Failed to create department.');
      return;
    }

    toast.success('Department created!');
    setIsAddOpen(false);
    setNewName('');
    refreshDepartments?.();
  };
console.log('DEPARTMENTS PAGE RENDERING');

  const openEdit = (dept) => {
    setEditTarget(dept);
    setEditName(dept.name);
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!editTarget || !editName.trim()) return;

    setSaving(true);
    const { error } = await updateDepartment(editTarget.id, { name: editName.trim() });
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to rename department.');
      return;
    }

    toast.success('Department renamed!');
    setEditTarget(null);
    refreshDepartments?.();
  };

  const handleToggleActive = async (dept) => {
    const nextActive = !dept.is_active;
    if (nextActive === false) {
      const confirmed = window.confirm(
        `Deactivate "${dept.name}"? It will be hidden from new transactions/budgets but existing history is preserved.`
      );
      if (!confirmed) return;
    }

    setTogglingId(dept.id);
    const { error } = await updateDepartment(dept.id, { is_active: nextActive });
    setTogglingId(null);

    if (error) {
      toast.error(error.message || 'Failed to update department status.');
      return;
    }

    toast.success(nextActive ? 'Department reactivated.' : 'Department deactivated.');
    refreshDepartments?.();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Departments</h1>
          <p className="text-sm text-slate-400 mt-1">
            {canManage
              ? 'Manage the departments your team\'s spend is organized under.'
              : 'Departments your workspace is organized under.'}
          </p>
        </div>
        {canManage && (
          <Button variant="primary" size="md" onClick={openAdd}>
            <Plus size={16} className="mr-1.5" />
            Add Department
          </Button>
        )}
      </div>

      <Card glass className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="rect" className="h-14" count={4} />
          </div>
        ) : !departments || departments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Departments help you scope spend, budgets, and approvals to teams like Engineering or Marketing."
              actionText={canManage ? 'Add Department' : undefined}
              onAction={canManage ? openAdd : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{dept.name}</p>
                    <p className="text-xs text-slate-500">
                      Created {dept.created_at ? new Date(dept.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={dept.is_active ? 'success' : 'default'}>
                    {dept.is_active ? 'Active' : 'Inactive'}
                  </Badge>

                  {canManage && (
                    <>
                      <button
                        onClick={() => openEdit(dept)}
                        className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Rename"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(dept)}
                        disabled={togglingId === dept.id}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          dept.is_active
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={dept.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {dept.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Department Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Department">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Department Name"
            placeholder="e.g. Product, Design, Support"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <Button type="submit" className="w-full justify-center" loading={creating} disabled={creating}>
            Create Department
          </Button>
        </form>
      </Modal>

      {/* Rename Department Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Rename Department">
        <form onSubmit={handleRename} className="space-y-4">
          <Input
            label="Department Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
            required
          />
          <Button type="submit" className="w-full justify-center" loading={saving} disabled={saving}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default Departments;