import React, { useEffect, useState } from 'react';
import { Wallet, Download, FileX2 } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Skeleton from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import { listPayrollForEmployee, getPayslipUrl } from '../../../services/payrollService';

function formatCurrency(value, currency = '₹') {
  const num = Number(value || 0);
  return `${currency}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonthYear(month, year) {
  if (!month || !year) return '—';
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function sortByPeriodDesc(records) {
  return [...records].sort((a, b) => {
    if (a.pay_period_year !== b.pay_period_year) return b.pay_period_year - a.pay_period_year;
    return b.pay_period_month - a.pay_period_month;
  });
}

/**
 * My Payroll tab — reuses the existing payrollService.js as-is.
 * GET /api/employees/:employeeId/payroll and .../payslip now
 * transparently allow self-access without the salary.read_department
 * grant (see the payrollRoutes.js/payrollController.js/
 * payrollService.js changes from the previous step) — no frontend
 * service changes were needed for that.
 */
export function MyPayrollTab({ employee }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!employee?.id) return;
      setLoading(true);
      const { data, error: fetchError } = await listPayrollForEmployee(employee.id);
      if (!active) return;
      setRecords(Array.isArray(data) ? sortByPeriodDesc(data) : []);
      setError(fetchError);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [employee?.id]);

  async function handleDownload(record) {
    setDownloadingId(record.id);
    const { data, error: urlError } = await getPayslipUrl(employee.id, record.id);
    setDownloadingId(null);
    if (urlError || !data?.url) return;
    window.open(data.url, '_blank', 'noopener,noreferrer');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="rect" className="h-28" />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Couldn't load payroll records"
        description={typeof error === 'string' ? error : error?.message || 'Please try again later.'}
      />
    );
  }

  const latest = records[0];

  return (
    <div className="space-y-6">
      {/* Salary Summary */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
          <Wallet size={16} className="text-slate-500" />
          Salary Summary
        </h3>
        {!latest ? (
          <p className="text-sm text-slate-500">No payroll records yet.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-1">
              Latest pay period · {formatMonthYear(latest.pay_period_month, latest.pay_period_year)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-4">
              <SummaryStat label="Base Salary" value={formatCurrency(latest.base_salary)} />
              <SummaryStat label="Allowances" value={formatCurrency(latest.allowances_total)} />
              <SummaryStat label="Deductions" value={formatCurrency(Number(latest.tax_deducted || 0) + Number(latest.other_deductions || 0))} />
              <SummaryStat label="Net Salary" value={formatCurrency(latest.net_salary)} highlight />
            </div>
          </>
        )}
      </Card>

      {/* Payroll History / Payslips */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
          <Wallet size={16} className="text-slate-500" />
          Payslips & Payroll History
        </h3>

        {records.length === 0 ? (
          <EmptyState
            icon={FileX2}
            title="No payslips yet"
            description="Your payslips will appear here once HR processes a pay period."
          />
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {formatMonthYear(r.pay_period_month, r.pay_period_year)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Net: {formatCurrency(r.net_salary)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.payslip_storage_path ? (
                    <Badge variant="success">Available</Badge>
                  ) : (
                    <Badge variant="default">No payslip</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!r.payslip_storage_path || downloadingId === r.id}
                    loading={downloadingId === r.id}
                    onClick={() => handleDownload(r)}
                  >
                    <Download size={14} className="mr-1.5" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, highlight = false }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-extrabold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export default MyPayrollTab;
