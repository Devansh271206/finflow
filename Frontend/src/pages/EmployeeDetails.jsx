import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Briefcase, Calendar, Hash, Building2, ChevronLeft, DollarSign, FileText, Clock, UploadCloud, Trash2, Download, Wallet, Phone, MapPin, AlertCircle, StickyNote } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { Select, SelectItem } from '../components/ui/Select';
import { usePermissionContext } from '../context/PermissionContext';
import { useEmployeeContext } from '../context/EmployeeContext';
import { getEmployee, getDirectReports, getSelfEmployee } from '../services/employeeService';
import { listSalaryHistory } from '../services/salaryHistoryService';
import { listEmployeeDocuments, uploadEmployeeDocument, deleteEmployeeDocument } from '../services/employeeDocumentService';
import { listEmployeeTimeline } from '../services/employeeTimelineService';
import { listPayrollForEmployee, createPayrollRecord, uploadPayslip, getPayslipUrl } from '../services/payrollService';

const DOCUMENT_TYPES = ['offer_letter', 'id_proof', 'contract', 'certification', 'other'];

const STATUS_VARIANT = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'danger',
};

const EmployeeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissionContext() || {};
  const canRead = can ? can('employees.read') : false;
  const canManage = can ? can('employees.manage') : false;
  const canManagePayroll = can ? can('payroll.manage') : false;

  const { selfEmployee } = useEmployeeContext() || {};

  const [employee, setEmployee] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salaryError, setSalaryError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState(DOCUMENT_TYPES[0]);

  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payrollError, setPayrollError] = useState(null);
  const [payrollForm, setPayrollForm] = useState({
    payPeriodMonth: '', payPeriodYear: '', baseSalary: '', allowancesTotal: '',
    bonusTotal: '', taxDeducted: '', otherDeductions: '', netSalary: '',
  });
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [payrollWarnings, setPayrollWarnings] = useState([]);

  const isSelf = id === 'me' || (selfEmployee && selfEmployee.id === id);

  const fetchSideData = useCallback(async (employeeId) => {
    // Salary History, Documents, and Timeline are fetched independently
    // of each other and of the main employee/reports fetch above — a
    // caller without an active salary.read_department grant will get a
    // 403 from listSalaryHistory() specifically (that's expected, not
    // a bug), and that shouldn't prevent Documents/Timeline from
    // loading, or vice versa.
    const [salaryRes, docsRes, timelineRes, payrollRes] = await Promise.all([
      listSalaryHistory(employeeId),
      listEmployeeDocuments(employeeId),
      listEmployeeTimeline(employeeId),
      listPayrollForEmployee(employeeId),
    ]);

    if (salaryRes.error) {
      setSalaryError(
        salaryRes.error.status === 403
          ? "You don't have access to salary history for this employee."
          : salaryRes.error.message
      );
      setSalaryHistory([]);
    } else {
      setSalaryError(null);
      setSalaryHistory(salaryRes.data || []);
    }

    if (payrollRes.error) {
      setPayrollError(
        payrollRes.error.status === 403
          ? "You don't have access to payroll records for this employee."
          : payrollRes.error.message
      );
      setPayrollRecords([]);
    } else {
      setPayrollError(null);
      setPayrollRecords(payrollRes.data || []);
    }

    setDocuments(docsRes.error ? [] : docsRes.data || []);
    setTimeline(timelineRes.error ? [] : timelineRes.data || []);
  }, []);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    // If it's me, we don't need employees.read permission
    if (!isSelf && !canRead && id !== 'me') {
      setError("You do not have permission to view this profile.");
      setLoading(false);
      return;
    }

    let empData = null;
    if (id === 'me') {
       const res = await getSelfEmployee();
       if (res.error) {
         setError(res.error.message);
       } else {
         empData = res.data;
       }
    } else {
       const res = await getEmployee(id);
       if (res.error) {
         setError(res.error.message);
       } else {
         empData = res.data;
       }
    }

    setEmployee(empData);

    // If we successfully loaded the employee, fetch their direct
    // reports and the three Sprint 2 panels' data.
    if (empData && !empData.error) {
      const repRes = await getDirectReports(empData.id);
      if (!repRes.error && Array.isArray(repRes.data)) {
        setReports(repRes.data);
      }
      await fetchSideData(empData.id);
    }

    setLoading(false);
  }, [id, isSelf, canRead, fetchSideData]);

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    setUploading(true);
    const res = await uploadEmployeeDocument(employee.id, file, uploadType);
    setUploading(false);
    e.target.value = '';

    if (!res.error) {
      const docsRes = await listEmployeeDocuments(employee.id);
      setDocuments(docsRes.error ? documents : docsRes.data || []);
    }
  };

  const handleDocumentDelete = async (documentId) => {
    if (!employee) return;
    const res = await deleteEmployeeDocument(employee.id, documentId);
    if (!res.error) {
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    }
  };

  const handlePayrollCreate = async (e) => {
    e.preventDefault();
    if (!employee) return;

    setSavingPayroll(true);
    setPayrollWarnings([]);
    const { data, error } = await createPayrollRecord(employee.id, {
      payPeriodMonth: Number(payrollForm.payPeriodMonth),
      payPeriodYear: Number(payrollForm.payPeriodYear),
      baseSalary: Number(payrollForm.baseSalary),
      allowancesTotal: payrollForm.allowancesTotal ? Number(payrollForm.allowancesTotal) : undefined,
      bonusTotal: payrollForm.bonusTotal ? Number(payrollForm.bonusTotal) : undefined,
      taxDeducted: payrollForm.taxDeducted ? Number(payrollForm.taxDeducted) : undefined,
      otherDeductions: payrollForm.otherDeductions ? Number(payrollForm.otherDeductions) : undefined,
      netSalary: Number(payrollForm.netSalary),
    });
    setSavingPayroll(false);

    if (error) {
      setPayrollError(error.message);
      return;
    }

    // Non-blocking warnings (PRD §18.2) — the record was still saved;
    // surface them but don't treat this as a failure.
    setPayrollWarnings(data?.warnings || []);
    setPayrollRecords((prev) => [data.record, ...prev]);
    setShowPayrollForm(false);
    setPayrollForm({
      payPeriodMonth: '', payPeriodYear: '', baseSalary: '', allowancesTotal: '',
      bonusTotal: '', taxDeducted: '', otherDeductions: '', netSalary: '',
    });
  };

  const handlePayslipUpload = async (recordId, file) => {
    if (!employee || !file) return;
    await uploadPayslip(employee.id, recordId, file);
    const res = await listPayrollForEmployee(employee.id);
    if (!res.error) setPayrollRecords(res.data || []);
  };

  const handlePayslipDownload = async (recordId) => {
    if (!employee) return;
    const { data, error } = await getPayslipUrl(employee.id, recordId);
    if (!error && data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="rect" className="h-32" />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-6">
        <EmptyState
          icon={User}
          title={error ? "Access Denied / Error" : "Employee Not Found"}
          description={error || "The employee you are looking for does not exist or you don't have access."}
          action={<Button onClick={() => navigate(-1)}>Go Back</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Employee Profile</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isSelf ? 'Your personal information' : `Details for ${employee.full_name}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Core Info */}
        <Card glass className="p-6 flex flex-col items-center text-center lg:col-span-1">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-3xl uppercase mb-4 shadow-xl shadow-indigo-500/10">
            {employee.full_name.charAt(0)}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{employee.full_name}</h2>
          <p className="text-indigo-400 font-medium mb-3">{employee.designation}</p>
          
          <Badge variant={STATUS_VARIANT[employee.employment_status] || 'default'} className="mb-6">
            {employee.employment_status.replace('_', ' ')}
          </Badge>

          <div className="w-full space-y-3 pt-4 border-t border-white/5 text-left text-sm">
            <div className="flex items-center gap-3 text-slate-300">
              <Hash size={16} className="text-slate-500" />
              <span><strong className="text-white">Code:</strong> {employee.employee_code}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Building2 size={16} className="text-slate-500" />
              <span><strong className="text-white">Dept:</strong> {employee.department || 'Unassigned'}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <User size={16} className="text-slate-500" />
              <span><strong className="text-white">Type:</strong> {employee.employment_type.replace('_', ' ')}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Detailed info & Reports */}
        <div className="lg:col-span-2 space-y-6">
          <Card glass className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">Timeline & Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date of Joining</label>
                  <p className="text-slate-300 flex items-center gap-2 mt-1">
                    <Calendar size={14} className="text-indigo-400" />
                    {new Date(employee.date_of_joining).toLocaleDateString()}
                  </p>
                </div>
                {employee.date_of_exit && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date of Exit</label>
                    <p className="text-slate-300 flex items-center gap-2 mt-1">
                      <Calendar size={14} className="text-rose-400" />
                      {new Date(employee.date_of_exit).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reporting Manager</label>
                  <p className="text-slate-300 flex items-center gap-2 mt-1">
                    <Briefcase size={14} className="text-indigo-400" />
                    {employee.reporting_manager_name || 'None'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Sprint 7: Contact Information / Emergency Contact / Notes.
              Read-only here — editing happens via the Add/Edit Employee
              modal on the Employees directory page, same as every other
              field on this card set. Only rendered when at least one of
              the fields is present, so profiles created before this
              sprint (all fields null) don't show an empty card. */}
          {(employee.phone || employee.address || employee.emergency_contact_name || employee.emergency_contact_phone || employee.notes) && (
            <Card glass className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">Contact & Emergency Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {employee.phone && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</label>
                      <p className="text-slate-300 flex items-center gap-2 mt-1">
                        <Phone size={14} className="text-indigo-400" />
                        {employee.phone}
                      </p>
                    </div>
                  )}
                  {employee.address && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</label>
                      <p className="text-slate-300 flex items-center gap-2 mt-1">
                        <MapPin size={14} className="text-indigo-400" />
                        {employee.address}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {(employee.emergency_contact_name || employee.emergency_contact_phone) && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Emergency Contact</label>
                      <p className="text-slate-300 flex items-center gap-2 mt-1">
                        <AlertCircle size={14} className="text-amber-400" />
                        {[employee.emergency_contact_name, employee.emergency_contact_phone].filter(Boolean).join(' — ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {employee.notes && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <StickyNote size={14} className="text-slate-500" />
                    Notes
                  </label>
                  <p className="text-slate-300 text-sm mt-2 whitespace-pre-wrap">{employee.notes}</p>
                </div>
              )}
            </Card>
          )}

          <Card glass className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">Direct Reports ({reports.length})</h3>
            {reports.length === 0 ? (
              <p className="text-slate-400 text-sm">This employee has no direct reports.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reports.map(rep => (
                  <div key={rep.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => navigate(`/employees/${rep.id}`)}>
                    <div>
                      <p className="text-sm font-semibold text-white">{rep.full_name}</p>
                      <p className="text-xs text-slate-500">{rep.designation}</p>
                    </div>
                    <Badge variant="default">{rep.employee_code}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Salary History */}
          <Card glass className="p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-400" />
              Salary History
            </h3>
            {salaryError ? (
              <p className="text-slate-400 text-sm">{salaryError}</p>
            ) : salaryHistory.length === 0 ? (
              <p className="text-slate-400 text-sm">No salary revisions recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {salaryHistory.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        CTC: {rev.ctc_annual} <span className="text-slate-500 font-normal">(base {rev.base_salary})</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Effective {new Date(rev.effective_date).toLocaleDateString()}
                        {rev.revision_reason ? ` — ${rev.revision_reason}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Employee Documents */}
          <Card glass className="p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={18} className="text-indigo-400" />
              Documents
            </h3>

            {canManage && (
              <div className="flex items-center gap-3 mb-4">
                <Select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="max-w-[200px]">
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                  ))}
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer border border-dashed border-white/15 rounded-lg px-3 py-2 transition-colors">
                  <UploadCloud size={16} />
                  {uploading ? 'Uploading…' : 'Upload document'}
                  <input type="file" className="hidden" onChange={handleDocumentUpload} disabled={uploading} />
                </label>
              </div>
            )}

            {documents.length === 0 ? (
              <p className="text-slate-400 text-sm">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{doc.documentType.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-white transition-colors" title="Download (link expires shortly)">
                        <Download size={16} />
                      </a>
                      {canManage && (
                        <button onClick={() => handleDocumentDelete(doc.id)} className="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Employee Timeline */}
          <Card glass className="p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-amber-400" />
              Timeline
            </h3>
            {timeline.length === 0 ? (
              <p className="text-slate-400 text-sm">No timeline events yet.</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-300">{event.description}</p>
                      <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Payroll Records */}
          <Card glass className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet size={18} className="text-teal-400" />
                Payroll Records
              </h3>
              {canManagePayroll && (
                <button
                  onClick={() => setShowPayrollForm((v) => !v)}
                  className="text-xs text-teal-400 hover:text-teal-300 font-medium"
                >
                  {showPayrollForm ? 'Cancel' : '+ Record Payroll'}
                </button>
              )}
            </div>

            {payrollWarnings.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/10">
                {payrollWarnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-300">{w}</p>
                ))}
              </div>
            )}

            {showPayrollForm && (
              <form onSubmit={handlePayrollCreate} className="grid grid-cols-2 gap-3 mb-4 p-4 rounded-lg bg-white/[0.02] border border-white/5">
                <input required type="number" min="1" max="12" placeholder="Month (1-12)" value={payrollForm.payPeriodMonth} onChange={(e) => setPayrollForm({ ...payrollForm, payPeriodMonth: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <input required type="number" min="2000" max="2100" placeholder="Year" value={payrollForm.payPeriodYear} onChange={(e) => setPayrollForm({ ...payrollForm, payPeriodYear: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <input required type="number" step="0.01" min="0" placeholder="Base Salary" value={payrollForm.baseSalary} onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <input type="number" step="0.01" min="0" placeholder="Allowances" value={payrollForm.allowancesTotal} onChange={(e) => setPayrollForm({ ...payrollForm, allowancesTotal: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <input type="number" step="0.01" min="0" placeholder="Bonus" value={payrollForm.bonusTotal} onChange={(e) => setPayrollForm({ ...payrollForm, bonusTotal: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <input type="number" step="0.01" min="0" placeholder="Tax Deducted" value={payrollForm.taxDeducted} onChange={(e) => setPayrollForm({ ...payrollForm, taxDeducted: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <input type="number" step="0.01" min="0" placeholder="Other Deductions" value={payrollForm.otherDeductions} onChange={(e) => setPayrollForm({ ...payrollForm, otherDeductions: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <input required type="number" step="0.01" min="0" placeholder="Net Salary" value={payrollForm.netSalary} onChange={(e) => setPayrollForm({ ...payrollForm, netSalary: e.target.value })} className="text-sm rounded-lg bg-white/5 border border-white/10 p-2 text-slate-200" />
                <button type="submit" disabled={savingPayroll} className="col-span-2 text-sm bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 font-medium transition-colors">
                  {savingPayroll ? 'Saving…' : 'Save Payroll Record'}
                </button>
              </form>
            )}

            {payrollError ? (
              <p className="text-slate-400 text-sm">{payrollError}</p>
            ) : payrollRecords.length === 0 ? (
              <p className="text-slate-400 text-sm">No payroll records yet.</p>
            ) : (
              <div className="space-y-2">
                {payrollRecords.map((r) => (
                  <div key={r.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {r.pay_period_month}/{r.pay_period_year} — Net: {r.net_salary}
                      </p>
                      <p className="text-xs text-slate-500">Base: {r.base_salary} · Recorded {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.payslip_storage_path ? (
                        <button onClick={() => handlePayslipDownload(r.id)} className="p-2 text-slate-400 hover:text-white transition-colors" title="Download Payslip">
                          <Download size={16} />
                        </button>
                      ) : canManagePayroll ? (
                        <label className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer">
                          Upload Payslip
                          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handlePayslipUpload(r.id, e.target.files[0])} />
                        </label>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetails;