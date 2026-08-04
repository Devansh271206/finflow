import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Edit2, UserPlus, PowerOff } from 'lucide-react';
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
import { listEmployees, createEmployee, updateEmployee, terminateEmployee } from '../services/employeeService';

const STATUS_VARIANT = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'danger',
};

// Sprint 7: Contact Information / Emergency Contact / Notes — added to
// the existing add/edit form below. Kept as their own object literal
// (rather than inlined into the two formData initializers) so the
// "reset to blank" and "reset to already-terminated defaults" cases
// can't drift out of sync with each other.
const BLANK_CONTACT_FIELDS = {
  phone: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  notes: '',
};

const Employees = () => {
  const { can } = usePermissionContext() || {};
  const canRead = can ? can('employees.read') : false;
  const canManage = can ? can('employees.manage') : false;

  const { activeDepartments } = useDepartmentContext() || {};
  const { activeEmployees } = useEmployeeContext() || {};

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    designation: '',
    departmentId: '',
    reportingManagerId: '',
    employmentStatus: 'active',
    employmentType: 'full_time',
    dateOfJoining: new Date().toISOString().slice(0, 10),
    ...BLANK_CONTACT_FIELDS,
  });

  const refreshEmployees = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await listEmployees({
      search: search || undefined,
      department_id: departmentFilter || undefined,
      employment_status: statusFilter || undefined,
    });
    if (!error && data?.items) {
      setEmployees(data.items);
    } else {
      setEmployees([]);
    }
    setLoading(false);
  }, [canRead, search, departmentFilter, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshEmployees();
    }, 300);
    return () => clearTimeout(timeout);
  }, [refreshEmployees]);

  const openAddModal = () => {
    setEditTarget(null);
    setFormData({
      employeeCode: '',
      fullName: '',
      designation: '',
      departmentId: '',
      reportingManagerId: '',
      employmentStatus: 'active',
      employmentType: 'full_time',
      dateOfJoining: new Date().toISOString().slice(0, 10),
      ...BLANK_CONTACT_FIELDS,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (employee) => {
    setEditTarget(employee);
    setFormData({
      employeeCode: employee.employee_code || '',
      fullName: employee.full_name || '',
      designation: employee.designation || '',
      departmentId: employee.department_id || '',
      reportingManagerId: employee.reporting_manager_id || '',
      employmentStatus: employee.employment_status || 'active',
      employmentType: employee.employment_type || 'full_time',
      dateOfJoining: employee.date_of_joining?.slice(0, 10) || '',
      phone: employee.phone || '',
      address: employee.address || '',
      emergencyContactName: employee.emergency_contact_name || '',
      emergencyContactPhone: employee.emergency_contact_phone || '',
      notes: employee.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = { ...formData };
    if (!payload.reportingManagerId) payload.reportingManagerId = null;
    // Empty strings sent for optional contact fields become null, not ""
    // — mirrors how reportingManagerId is already handled above, and
    // matches the backend's `field || null` normalization.
    ['phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'notes'].forEach((key) => {
      if (!payload[key]) payload[key] = null;
    });

    let error = null;
    if (editTarget) {
      const res = await updateEmployee(editTarget.id, payload);
      error = res.error;
    } else {
      const res = await createEmployee(payload);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to save employee.');
      return;
    }

    toast.success(editTarget ? 'Employee updated.' : 'Employee added.');
    setIsModalOpen(false);
    refreshEmployees();
  };

  const handleTerminate = async (employee) => {
    const confirmed = window.confirm(`Terminate ${employee.full_name}? This will set their status to terminated.`);
    if (!confirmed) return;

    const { error } = await terminateEmployee(employee.id, {
      dateOfExit: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      toast.error(error.message || 'Failed to terminate employee.');
      return;
    }

    toast.success('Employee terminated successfully.');
    refreshEmployees();
  };

  if (!canRead) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Users}
          title="Access Denied"
          description="You do not have permission to view the employee directory. You may only view your own profile."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Employee Directory</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your organization's workforce.
          </p>
        </div>
        {canManage && (
          <Button onClick={openAddModal} className="gap-2">
            <UserPlus size={16} />
            Add Employee
          </Button>
        )}
      </div>

      <Card glass className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[220px]">
            <Input
              icon={Search}
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <SelectItem value="">All Departments</SelectItem>
            {(activeDepartments || []).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </Select>
        </div>
      </Card>

      <Card glass className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="rect" className="h-14" count={4} />
          </div>
        ) : !employees || employees.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No employees found"
              description="Try adjusting your search or filters."
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors flex-wrap gap-3"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 shrink-0 font-semibold text-sm uppercase">
                    {(emp.full_name || '?').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {emp.full_name} <span className="text-slate-500 font-normal ml-1">#{emp.employee_code}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {emp.designation} • {emp.department || 'No Dept'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {emp.reporting_manager_name && (
                    <Badge variant="default" className="hidden sm:inline-flex">
                      Reports to: {emp.reporting_manager_name}
                    </Badge>
                  )}
                  <Badge variant={STATUS_VARIANT[emp.employment_status] || 'default'}>
                    {emp.employment_status.replace('_', ' ')}
                  </Badge>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(emp)}
                      className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="Edit Employee"
                    >
                      <Edit2 size={16} />
                    </button>
                    {emp.employment_status !== 'terminated' && (
                      <button
                        onClick={() => handleTerminate(emp)}
                        className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Terminate"
                      >
                        <PowerOff size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editTarget ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee Code</label>
              <Input
                required
                placeholder="EMP-001"
                value={formData.employeeCode}
                onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
              <Input
                required
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Designation</label>
              <Input
                required
                placeholder="Software Engineer"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</label>
              <Select
                required
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              >
                <SelectItem value="" disabled>Select Dept</SelectItem>
                {(activeDepartments || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reporting Manager</label>
              <Select
                value={formData.reportingManagerId}
                onChange={(e) => setFormData({ ...formData, reportingManagerId: e.target.value })}
              >
                <SelectItem value="">None</SelectItem>
                {(activeEmployees || [])
                  .filter((emp) => emp.id !== editTarget?.id)
                  .map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name} ({emp.designation})</SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Employment Type</label>
              <Select
                required
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              >
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date of Joining</label>
              <Input
                type="date"
                required
                value={formData.dateOfJoining}
                onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
              />
            </div>
            {editTarget && (
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                <Select
                  required
                  value={formData.employmentStatus}
                  onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                >
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </Select>
              </div>
            )}
          </div>

          {/* Sprint 7: Contact Information */}
          <div className="pt-2 border-t border-white/5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 mt-3">
              Contact Information
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</label>
                <Input
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Address</label>
                <Input
                  placeholder="Street, City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Sprint 7: Emergency Contact */}
          <div className="pt-2 border-t border-white/5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 mt-3">
              Emergency Contact
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Name</label>
                <Input
                  placeholder="Jane Doe"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Phone</label>
                <Input
                  placeholder="+91 98765 43210"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Sprint 7: Notes */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex flex-col gap-1.5 mt-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
              {/* No Textarea component exists in components/ui/ yet — styled
                  inline to match Input.jsx's classes rather than introducing
                  a new shared component for one field. */}
              <textarea
                rows={3}
                placeholder="Any additional notes about this employee..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm transition-all duration-200 outline-none placeholder:text-slate-600 px-4 py-3 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30 resize-none"
              />
            </div>
          </div>

          <Button type="submit" className="w-full justify-center mt-2" loading={saving} disabled={saving}>
            {editTarget ? 'Save Changes' : 'Add Employee'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default Employees;