import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Search, Plus, Pencil, Power, PowerOff, UserCog, UserPlus, UserMinus } from 'lucide-react';
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
import { useEmployeeContext } from '../context/EmployeeContext';
import {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  assignDepartmentHead,
} from '../services/departmentService';
import { updateEmployee } from '../services/employeeService';

const PAGE_SIZE = 10;

const Departments = () => {
  const { can } = usePermissionContext() || {};
  const canManage = can ? can('departments.manage') : false;

  const { activeEmployees } = useEmployeeContext() || {};

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  const [detailsDept, setDetailsDept] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [headEmployeeId, setHeadEmployeeId] = useState('');
  const [savingHead, setSavingHead] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [removingEmployeeId, setRemovingEmployeeId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refreshDepartments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listDepartments({
      search: search || undefined,
      status: statusFilter || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      page_size: PAGE_SIZE,
    });

    if (!error && data) {
      setDepartments(data.items || []);
      setTotal(data.total || 0);
    } else {
      setDepartments([]);
      setTotal(0);
    }
    setLoading(false);
  }, [search, statusFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshDepartments();
    }, 300);
    return () => clearTimeout(timeout);
  }, [refreshDepartments]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy, sortOrder]);

  const openAdd = () => {
    setEditTarget(null);
    setFormName('');
    setIsFormOpen(true);
  };

  const openEdit = (dept) => {
    setEditTarget(dept);
    setFormName(dept.name);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    const { error } = editTarget
      ? await updateDepartment(editTarget.id, { name: formName.trim() })
      : await createDepartment(formName.trim());
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to save department.');
      return;
    }

    toast.success(editTarget ? 'Department updated!' : 'Department created!');
    setIsFormOpen(false);
    refreshDepartments();
  };

  const handleToggleActive = async (dept) => {
    const nextActive = !dept.is_active;
    if (!nextActive) {
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
    refreshDepartments();
  };

  const openDetails = async (dept) => {
    setDetailsDept(dept);
    setHeadEmployeeId(dept.head?.id || '');
    setDetailsLoading(true);
    const { data, error } = await getDepartment(dept.id);
    setDetailsLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to load department details.');
      return;
    }
    setDetailsDept(data);
    setHeadEmployeeId(data.head?.id || '');
  };

  const refreshDetails = async (deptId) => {
    const { data, error } = await getDepartment(deptId);
    if (!error) setDetailsDept(data);
  };

  const handleAssignHead = async () => {
    if (!detailsDept) return;
    setSavingHead(true);
    const { error } = await assignDepartmentHead(detailsDept.id, headEmployeeId || null);
    setSavingHead(false);

    if (error) {
      toast.error(error.message || 'Failed to assign department head.');
      return;
    }

    toast.success(headEmployeeId ? 'Department head assigned.' : 'Department head cleared.');
    refreshDetails(detailsDept.id);
    refreshDepartments();
  };

  const eligibleHeads = (activeEmployees || []).filter(
    (emp) => detailsDept && (!emp.department_id || emp.department_id === detailsDept.id)
  );

  const deptEmployees = (activeEmployees || []).filter(
    (emp) => emp.department_id === detailsDept?.id
  );

  const eligibleMembers = (activeEmployees || []).filter(
    (emp) => detailsDept && emp.department_id !== detailsDept.id
  );

  const closeDetails = () => {
    setDetailsDept(null);
    setAddEmployeeId('');
  };

  const handleAddEmployee = async () => {
    if (!detailsDept || !addEmployeeId) return;
    setAddingEmployee(true);
    const { error } = await updateEmployee(addEmployeeId, { departmentId: detailsDept.id });
    setAddingEmployee(false);

    if (error) {
      toast.error(error.message || 'Failed to add employee.');
      return;
    }

    toast.success('Employee assigned to department.');
    setAddEmployeeId('');
    refreshDetails(detailsDept.id);
  };

  const handleRemoveEmployee = async (employeeId) => {
    if (!detailsDept) return;
    setRemovingEmployeeId(employeeId);
    const { error } = await updateEmployee(employeeId, { departmentId: null });
    setRemovingEmployeeId(null);

    if (error) {
      toast.error(error.message || 'Failed to remove employee.');
      return;
    }

    toast.success('Employee removed from department.');
    refreshDetails(detailsDept.id);
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

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
                <button
                  className="flex items-center gap-4 min-w-0 text-left flex-1"
                  onClick={() => openDetails(dept)}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{dept.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {dept.head?.full_name
                        ? `Head: ${dept.head.full_name}`
                        : 'No head assigned'}
                      {' · '}
                      Created {dept.created_at
                        ? new Date(dept.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={dept.is_active ? 'success' : 'default'}>
                    {dept.is_active ? 'Active' : 'Inactive'}
                  </Badge>

                  {canManage && (
                    <>
                      <button
                        onClick={() => openDetails(dept)}
                        className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Manage head & employees"
                      >
                        <UserCog size={16} />
                      </button>
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

        {!loading && departments.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} · {total} department{total === 1 ? '' : 's'}
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

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editTarget ? 'Rename Department' : 'Add Department'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Department Name"
            placeholder="e.g. Product, Design, Support"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoFocus
            required
          />
          <Button
            type="submit"
            className="w-full justify-center"
            loading={saving}
            disabled={saving}
          >
            {editTarget ? 'Save Changes' : 'Create Department'}
          </Button>
        </form>
      </Modal>

      <Modal isOpen={!!detailsDept} onClose={closeDetails} title={detailsDept ? `${detailsDept.name} — Details` : 'Department Details'} size="lg">
        {detailsLoading || !detailsDept ? (
          <Skeleton variant="rect" className="h-32" />
        ) : (
          <div className="space-y-5">
            <div className="text-xs text-slate-500">
              <Badge variant={detailsDept.is_active ? 'success' : 'default'}>
                {detailsDept.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {' · '}
              Created {detailsDept.created_at
                ? new Date(detailsDept.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                : '—'}
            </div>

            {canManage && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Department Head</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={headEmployeeId}
                    onChange={(e) => setHeadEmployeeId(e.target.value)}
                    placeholder="No head assigned"
                    className="flex-1"
                  >
                    <SelectItem value="">No head assigned</SelectItem>
                    {eligibleHeads.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </Select>
                  <Button size="sm" onClick={handleAssignHead} loading={savingHead} disabled={savingHead}>
                    Save
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Employees ({deptEmployees.length})
              </label>

              {canManage && (
                <div className="flex items-center gap-2 mb-3">
                  <Select
                    value={addEmployeeId}
                    onChange={(e) => setAddEmployeeId(e.target.value)}
                    placeholder="Assign an employee..."
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
                  <Button size="sm" onClick={handleAddEmployee} loading={addingEmployee} disabled={addingEmployee || !addEmployeeId}>
                    <UserPlus size={14} className="mr-1" />
                    Assign
                  </Button>
                </div>
              )}

              {deptEmployees.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No employees assigned to this department yet.</p>
              ) : (
                <div className="divide-y divide-white/5 rounded-lg border border-white/5 overflow-hidden">
                  {deptEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{emp.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.designation || '—'}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleRemoveEmployee(emp.id)}
                          disabled={removingEmployeeId === emp.id}
                          className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50 shrink-0"
                          title="Remove from department"
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

export default Departments;
