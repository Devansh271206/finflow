import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, UploadCloud, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { usePermissionContext } from '../context/PermissionContext';
import { useDepartmentContext } from '../context/DepartmentContext';
import { getPayrollSummary, importPayrollCsv } from '../services/payrollService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const Payroll = () => {
  const { can } = usePermissionContext() || {};
  const canManage = can ? can('payroll.manage') : false;
  const { departments } = useDepartmentContext() || {};

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getPayrollSummary({ month, year });
    if (!error) setSummary(data);
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const departmentName = (id) => departments?.find((d) => d.id === id)?.name || 'Unassigned';

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const { data, error } = await importPayrollCsv(file);
    setImporting(false);
    e.target.value = '';

    if (error) {
      toast.error(error.message || 'Import failed.');
      return;
    }

    setImportReport(data);
    toast.success(`Imported ${data.succeeded}/${data.totalRows} rows successfully.`);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Payroll</h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregate view only — no individual salary figures are shown here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200 w-24"
          />
          {canManage && (
            <label className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer border border-dashed border-white/15 rounded-lg px-3 py-2 transition-colors">
              <UploadCloud size={16} />
              {importing ? 'Importing…' : 'Import CSV'}
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton variant="rect" className="h-32" />
      ) : !summary || summary.recordCount === 0 ? (
        <Card glass className="p-6">
          <EmptyState
            icon={Wallet}
            title="No payroll records for this period"
            description="Record payroll from an employee's profile, or import a CSV for this period."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card glass className="p-4">
              <p className="text-xs text-slate-400">Total Net Payroll</p>
              <p className="text-xl font-bold text-white mt-1">{summary.totalNet.toLocaleString()}</p>
            </Card>
            <Card glass className="p-4">
              <p className="text-xs text-slate-400">Total Base Salary</p>
              <p className="text-xl font-bold text-white mt-1">{summary.totalBase.toLocaleString()}</p>
            </Card>
            <Card glass className="p-4">
              <p className="text-xs text-slate-400">Records This Period</p>
              <p className="text-xl font-bold text-white mt-1">{summary.recordCount}</p>
            </Card>
          </div>

          <Card glass className="p-0 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 size={15} />
                By Department
              </h3>
            </div>
            <div className="divide-y divide-white/5">
              {summary.byDepartment.map((d) => (
                <div key={d.departmentId} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-slate-300">{departmentName(d.departmentId)}</p>
                  <p className="text-sm text-slate-400">
                    {d.headcount} {d.headcount === 1 ? 'employee' : 'employees'} · Net {d.totalNet.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {importReport && (
        <Card glass className="p-4">
          <p className="text-sm font-semibold text-white mb-2">
            Last import: {importReport.succeeded} succeeded, {importReport.failed} failed
          </p>
          {importReport.results.filter((r) => !r.success).map((r) => (
            <p key={r.row} className="text-xs text-rose-400">Row {r.row}: {r.error}</p>
          ))}
        </Card>
      )}
    </div>
  );
};

export default Payroll;
