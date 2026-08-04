import React, { useState, useEffect, useCallback } from 'react';
import { Users2, Search, Plus, Pencil, Power, PowerOff, UserCog, UserPlus, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { Select, SelectItem } from '../components/ui/Select';
import { usePermissionContext } from '../context/PermissionContext';
import { useDepartmentContext } from '../context/DepartmentContext';
import { useEmployeeContext } from '../context/EmployeeContext';
import {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  assignTeamLead,
  addTeamMember,
  removeTeamMember,
} from '../services/teamService';

/**
 * Teams.jsx — Sprint 8 (PRD §15.20 Team Management).
 *
 * NOTE ON NAMING: this is deliberately a separate page/file from the
 * pre-existing Frontend/src/pages/TeamManagement.jsx, which despite its
 * name is actually the org-member/staff management page (invite, role,
 * org-department assignment via the `team.manage` permission). This
 * page is the real PRD §15.20 module: a Team is a sub-unit of a
 * Department, with its own Team Lead and member roster. The two are
 * unrelated and both are kept, to avoid overwriting working code.
 *
 * Scope note: budget, analytics, leave calendar, and dashboard
 * integration from PRD §15.20 are explicitly out of Sprint 8 — this
 * page covers CRUD, Team Lead assignment, member assignment, search,
 * filter, sort, and pagination only.
 */

const PAGE_SIZE = 10;

const Teams = () => {
  const { can } = usePermissionContext() || {};
  const canManage = can ? can('teams.manage') : false;

  const { activeDepartments } = useDepartmentContext() || {};
  const { activeEmployees } = useEmployeeContext() || {};

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Create / Edit modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // team object or null
  const [formData, setFormData] = useState({ department_id: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  // Team Details / member management modal
  const [detailsTeam, setDetailsTeam] = useState(null); // team object (with members) or null
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [leadEmployeeId, setLeadEmployeeId] = useState('');
  const [savingLead, setSavingLead] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refreshTeams = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listTeams({
      search: search || undefined,
      department_id: departmentFilter || undefined,
      status: statusFilter || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      page_size: PAGE_SIZE,
    });

    if (!error && data) {
      // Backend returns { items, total, page, pageSize } once pagination
      // params are sent (see teamController.js's getTeams) — page/page_size
      // are always sent above, so this branch is always taken.
      setTeams(data.items || []);
      setTotal(data.total || 0);
    } else {
      setTeams([]);
      setTotal(0);
    }
    setLoading(false);
  }, [search, departmentFilter, statusFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshTeams();
    }, 300);
    return () => clearTimeout(timeout);
  }, [refreshTeams]);

  // Reset to page 1 whenever a filter/search/sort changes (not on page
  // itself, to avoid an infinite loop).
  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, statusFilter, sortBy, sortOrder]);

  const departmentNameById = (id) => activeDepartments?.find((d) => d.id === id)?.name || '—';

  const openAdd = () => {
    setEditTarget(null);
    setFormData({ department_id: departmentFilter || '', name: '', description: '' });
    setIsFormOpen(true);
  };

  const openEdit = (team) => {
    setEditTarget(team);
    setFormData({ department_id: team.department_id, name: team.name, description: team.description || '' });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    const { error } = editTarget
      ? await updateTeam(editTarget.id, { name: formData.name.trim(), description: formData.description })
      : await createTeam({
          department_id: formData.department_id,
          name: formData.name.trim(),
          description: formData.description,
        });
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to save team.');
      return;
    }

    toast.success(editTarget ? 'Team updated!' : 'Team created!');
    setIsFormOpen(false);
    refreshTeams();
  };

  const handleToggleActive = async (team) => {
    const nextActive = !team.is_active;
    if (!nextActive) {
      const confirmed = window.confirm(
        `Deactivate "${team.name}"? Members remain assigned but the team will be hidden from active pickers.`
      );
      if (!confirmed) return;
    }

    setTogglingId(team.id);
    const { error } = await updateTeam(team.id, { is_active: nextActive });
    setTogglingId(null);

    if (error) {
      toast.error(error.message || 'Failed to update team status.');
      return;
    }

    toast.success(nextActive ? 'Team reactivated.' : 'Team deactivated.');
    refreshTeams();
  };

  const openDetails = async (team) => {
    setDetailsTeam(team);
    setLeadEmployeeId(team.team_lead_employee_id || '');
    setDetailsLoading(true);
    const { data, error } = await getTeam(team.id);
    setDetailsLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to load team details.');
      return;
    }
    setDetailsTeam(data);
    setLeadEmployeeId(data.team_lead_employee_id || '');
  };

  const closeDetails = () => {
    setDetailsTeam(null);
    setAddMemberId('');
  };

  const refreshDetails = async (teamId) => {
    const { data, error } = await getTeam(teamId);
    if (!error) setDetailsTeam(data);
  };

  const handleAssignLead = async () => {
    if (!detailsTeam) return;
    setSavingLead(true);
    const { error } = await assignTeamLead(detailsTeam.id, leadEmployeeId || null);
    setSavingLead(false);

    if (error) {
      toast.error(error.message || 'Failed to assign team lead.');
      return;
    }

    toast.success(leadEmployeeId ? 'Team lead assigned.' : 'Team lead cleared.');
    refreshDetails(detailsTeam.id);
    refreshTeams();
  };

  const handleAddMember = async () => {
    if (!detailsTeam || !addMemberId) return;
    setAddingMember(true);
    const { error } = await addTeamMember(detailsTeam.id, addMemberId);
    setAddingMember(false);

    if (error) {
      toast.error(error.message || 'Failed to add member.');
      return;
    }

    toast.success('Member added to team.');
    setAddMemberId('');
    refreshDetails(detailsTeam.id);
  };

  const handleRemoveMember = async (employeeId) => {
    if (!detailsTeam) return;
    setRemovingMemberId(employeeId);
    const { error } = await removeTeamMember(detailsTeam.id, employeeId);
    setRemovingMemberId(null);

    if (error) {
      toast.error(error.message || 'Failed to remove member.');
      return;
    }

    toast.success('Member removed from team.');
    refreshDetails(detailsTeam.id);
  };

  // Employees eligible to join detailsTeam: same department, not
  // already a member (mirrors teamService.js's addMember validation on
  // the frontend so the picker doesn't offer choices the backend would
  // reject).
  const eligibleMembers = (activeEmployees || []).filter(
    (emp) =>
      detailsTeam &&
      (!emp.department_id || emp.department_id === detailsTeam.department_id) &&
      emp.team_id !== detailsTeam.id
  );

  // Employees eligible to lead detailsTeam: same department (or no
  // department yet), mirroring teamService.js's assignLead validation.
  const eligibleLeads = (activeEmployees || []).filter(
    (emp) => detailsTeam && (!emp.department_id || emp.department_id === detailsTeam.department_id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Teams</h1>
          <p className="text-sm text-slate-400 mt-1">
            {canManage
              ? 'Manage teams within your departments, assign leads, and build rosters.'
              : 'Teams your departments are organized into.'}
          </p>
        </div>
        {canManage && (
          <Button variant="primary" size="md" onClick={openAdd}>
            <Plus size={16} className="mr-1.5" />
            Add Team
          </Button>
        )}
      </div>

      {/* Search / Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} placeholder="All Departments" className="w-48">
          <SelectItem value="">All Departments</SelectItem>
          {(activeDepartments || []).map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </Select>

        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All Statuses" className="w-40">
          <SelectItem value="">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </Select>

        <Select
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split(':');
            setSortBy(by);
            setSortOrder(order);
          }}
          placeholder="Sort"
          className="w-44"
        >
          <SelectItem value="name:asc">Name (A–Z)</SelectItem>
          <SelectItem value="name:desc">Name (Z–A)</SelectItem>
          <SelectItem value="created_at:desc">Newest first</SelectItem>
          <SelectItem value="created_at:asc">Oldest first</SelectItem>
        </Select>
      </div>

      <Card glass className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="rect" className="h-16" count={4} />
          </div>
        ) : !teams || teams.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users2}
              title="No teams yet"
              description="Teams let you organize a department into smaller operational units, each with its own lead and roster."
              actionText={canManage ? 'Add Team' : undefined}
              onAction={canManage ? openAdd : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <button
                  className="flex items-center gap-4 min-w-0 text-left flex-1"
                  onClick={() => openDetails(team)}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                    <Users2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{team.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {team.department?.name || departmentNameById(team.department_id)}
                      {team.lead?.full_name ? ` · Lead: ${team.lead.full_name}` : ' · No lead assigned'}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={team.is_active ? 'success' : 'default'}>
                    {team.is_active ? 'Active' : 'Inactive'}
                  </Badge>

                  {canManage && (
                    <>
                      <button
                        onClick={() => openDetails(team)}
                        className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Manage lead & members"
                      >
                        <UserCog size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(team)}
                        className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(team)}
                        disabled={togglingId === team.id}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          team.is_active
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={team.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {team.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && teams.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} · {total} team{total === 1 ? '' : 's'}
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

      {/* Create / Edit Team Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editTarget ? 'Edit Team' : 'Add Team'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editTarget && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Department</label>
              <Select
                value={formData.department_id}
                onChange={(e) => setFormData((f) => ({ ...f, department_id: e.target.value }))}
                placeholder="Select a department"
                required
              >
                {(activeDepartments || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </Select>
            </div>
          )}
          <Input
            label="Team Name"
            placeholder="e.g. Platform, Growth, Infra"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            required
          />
          <Input
            label="Description (optional)"
            placeholder="What does this team own?"
            value={formData.description}
            onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
          />
          <Button
            type="submit"
            className="w-full justify-center"
            loading={saving}
            disabled={saving || (!editTarget && !formData.department_id)}
          >
            {editTarget ? 'Save Changes' : 'Create Team'}
          </Button>
        </form>
      </Modal>

      {/* Team Details / Lead / Members Modal */}
      <Modal isOpen={!!detailsTeam} onClose={closeDetails} title={detailsTeam ? `${detailsTeam.name} — Team Details` : 'Team Details'}>
        {detailsLoading || !detailsTeam ? (
          <Skeleton variant="rect" className="h-32" />
        ) : (
          <div className="space-y-5">
            <div className="text-xs text-slate-500">
              {detailsTeam.department?.name || departmentNameById(detailsTeam.department_id)}
              {' · '}
              <Badge variant={detailsTeam.is_active ? 'success' : 'default'}>
                {detailsTeam.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {canManage && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Team Lead</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={leadEmployeeId}
                    onChange={(e) => setLeadEmployeeId(e.target.value)}
                    placeholder="No lead assigned"
                    className="flex-1"
                  >
                    <SelectItem value="">No lead assigned</SelectItem>
                    {eligibleLeads.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </Select>
                  <Button size="sm" onClick={handleAssignLead} loading={savingLead} disabled={savingLead}>
                    Save
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Members ({detailsTeam.members?.length || 0})
              </label>

              {canManage && (
                <div className="flex items-center gap-2 mb-3">
                  <Select
                    value={addMemberId}
                    onChange={(e) => setAddMemberId(e.target.value)}
                    placeholder="Add an employee..."
                    className="flex-1"
                  >
                    {eligibleMembers.length === 0 ? (
                      <SelectItem value="" disabled>No eligible employees</SelectItem>
                    ) : (
                      eligibleMembers.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                      ))
                    )}
                  </Select>
                  <Button size="sm" onClick={handleAddMember} loading={addingMember} disabled={addingMember || !addMemberId}>
                    <UserPlus size={14} className="mr-1" />
                    Add
                  </Button>
                </div>
              )}

              {!detailsTeam.members || detailsTeam.members.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No members yet.</p>
              ) : (
                <div className="divide-y divide-white/5 rounded-lg border border-white/5 overflow-hidden">
                  {detailsTeam.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{member.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.designation || '—'}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingMemberId === member.id}
                          className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50 shrink-0"
                          title="Remove from team"
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Teams;