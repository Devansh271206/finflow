import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, UserCog, Building2, Power, PowerOff, UserMinus, UserPlus } from 'lucide-react';
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
import { apiGet } from '../lib/apiClient';
import {
  listMembers,
  createMember,
  updateMemberRole,
  updateMemberDepartment,
  activateMember,
  deactivateMember,
  removeMember,
} from '../services/membershipService';

const STATUS_VARIANT = {
  active: 'success',
  invited: 'info',
  suspended: 'default',
};

const TeamManagement = () => {
  const { can } = usePermissionContext() || {};
  const canManage = can ? can('team.manage') : false;
  const { departments } = useDepartmentContext() || {};

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [roleTarget, setRoleTarget] = useState(null); // member object or null
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const [deptTarget, setDeptTarget] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  const [togglingId, setTogglingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRoleId, setAddRoleId] = useState('');
  const [addDeptId, setAddDeptId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const refreshMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listMembers({
      search: search || undefined,
      role: roleFilter || undefined,
      department: departmentFilter || undefined,
      status: statusFilter || undefined,
    });
    if (!error && Array.isArray(data)) {
      setMembers(data);
    } else {
      setMembers([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, departmentFilter, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshMembers();
    }, 300); // debounce search/filter changes
    return () => clearTimeout(timeout);
  }, [refreshMembers]);

  useEffect(() => {
    async function loadRoles() {
      const { data, error } = await apiGet('/roles');
      if (!error && Array.isArray(data)) {
        setRoles(data);
      }
    }
    loadRoles();
  }, []);

  const openRoleModal = (member) => {
    setSelectedRoleId(member.role_id || '');
    setRoleTarget(member);
  };

  const handleRoleSave = async (e) => {
    e.preventDefault();
    if (!roleTarget || !selectedRoleId) return;

    setSavingRole(true);
    const { error } = await updateMemberRole(roleTarget.id, selectedRoleId);
    setSavingRole(false);

    if (error) {
      toast.error(error.message || 'Failed to update role.');
      return;
    }

    toast.success('Member role updated.');
    setRoleTarget(null);
    refreshMembers();
  };

  const openDeptModal = (member) => {
    setSelectedDeptId(member.department_id || '');
    setDeptTarget(member);
  };

  const handleDeptSave = async (e) => {
    e.preventDefault();
    if (!deptTarget) return;

    setSavingDept(true);
    const { error } = await updateMemberDepartment(deptTarget.id, selectedDeptId || null);
    setSavingDept(false);

    if (error) {
      toast.error(error.message || 'Failed to update department.');
      return;
    }

    toast.success('Member department updated.');
    setDeptTarget(null);
    refreshMembers();
  };

  const handleToggleActive = async (member) => {
    const nextActive = member.status !== 'active';
    if (!nextActive) {
      const confirmed = window.confirm(
        `Deactivate ${member.profiles?.full_name || 'this member'}? They will lose access to this workspace until reactivated.`
      );
      if (!confirmed) return;
    }

    setTogglingId(member.id);
    const { error } = nextActive
      ? await activateMember(member.id)
      : await deactivateMember(member.id);
    setTogglingId(null);

    if (error) {
      toast.error(error.message || 'Failed to update member status.');
      return;
    }

    toast.success(nextActive ? 'Member activated.' : 'Member deactivated.');
    refreshMembers();
  };

  const openAddModal = () => {
    setAddEmail('');
    setAddRoleId('');
    setAddDeptId('');
    setAddModalOpen(true);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addEmail.trim() || !addRoleId) return;

    setAddingMember(true);
    const { error } = await createMember({
      email: addEmail.trim(),
      roleId: addRoleId,
      departmentId: addDeptId || null,
    });
    setAddingMember(false);

    if (error) {
      toast.error(error.message || 'Failed to add member.');
      return;
    }

    toast.success('Member added to workspace.');
    setAddModalOpen(false);
    refreshMembers();
  };

  const handleRemove = async (member) => {
    const confirmed = window.confirm(
      `Remove ${member.profiles?.full_name || 'this member'} from the workspace? They will lose access immediately.`
    );
    if (!confirmed) return;

    setRemovingId(member.id);
    const { error } = await removeMember(member.id);
    setRemovingId(null);

    if (error) {
      toast.error(error.message || 'Failed to remove member.');
      return;
    }

    toast.success('Member removed from workspace.');
    refreshMembers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Team Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            {canManage
              ? 'View and manage everyone in this workspace.'
              : 'Everyone in this workspace.'}
          </p>
        </div>
        {canManage && (
          <Button onClick={openAddModal} className="gap-2">
            <UserPlus size={16} />
            Add Member
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      <Card glass className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[220px]">
            <Input
              icon={Search}
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30"
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.key}>{r.name}</option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30"
          >
            <option value="">All Departments</option>
            {(departments || []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </Card>

      <Card glass className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="rect" className="h-14" count={4} />
          </div>
        ) : !members || members.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No members found"
              description="Try adjusting your search or filters."
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors flex-wrap gap-3"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 shrink-0 font-semibold text-sm">
                    {(member.profiles?.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {member.profiles?.full_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="info">{member.roles?.name || 'No role'}</Badge>
                  <Badge variant="default">{member.departments?.name || 'Unassigned'}</Badge>
                  <Badge variant={STATUS_VARIANT[member.status] || 'default'}>
                    {member.status}
                  </Badge>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openRoleModal(member)}
                      className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="Change role"
                    >
                      <UserCog size={16} />
                    </button>
                    <button
                      onClick={() => openDeptModal(member)}
                      className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="Change department"
                    >
                      <Building2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(member)}
                      disabled={togglingId === member.id}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                        member.status === 'active'
                          ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                          : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                      title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {member.status === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                    <button
                      onClick={() => handleRemove(member)}
                      disabled={removingId === member.id}
                      className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      title="Remove from workspace"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Change Role Modal */}
      <Modal isOpen={!!roleTarget} onClose={() => setRoleTarget(null)} title="Change Role">
        <form onSubmit={handleRoleSave} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Role
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30"
              autoFocus
              required
            >
              <option value="" disabled>Select a role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full justify-center" loading={savingRole} disabled={savingRole}>
            Save Changes
          </Button>
        </form>
      </Modal>

      {/* Change Department Modal */}
      <Modal isOpen={!!deptTarget} onClose={() => setDeptTarget(null)} title="Change Department">
        <form onSubmit={handleDeptSave} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Department
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30"
              autoFocus
            >
              <option value="">Unassigned</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full justify-center" loading={savingDept} disabled={savingDept}>
            Save Changes
          </Button>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <p className="text-xs text-slate-500 -mt-1">
            Adds an existing, already-registered user to this workspace by email.
            This does not send an invitation or create a new account.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Email
            </label>
            <Input
              type="email"
              placeholder="name@company.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Role
            </label>
            <select
              value={addRoleId}
              onChange={(e) => setAddRoleId(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30"
              required
            >
              <option value="" disabled>Select a role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Department
            </label>
            <select
              value={addDeptId}
              onChange={(e) => setAddDeptId(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30"
            >
              <option value="">Unassigned</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <Button type="submit" className="w-full justify-center" loading={addingMember} disabled={addingMember}>
            Add to Workspace
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default TeamManagement;