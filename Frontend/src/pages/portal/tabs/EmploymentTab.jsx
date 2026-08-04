import React from 'react';
import { Briefcase, Building2, Users, CalendarDays, Hash, BadgeCheck } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';

const STATUS_BADGE_VARIANT = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'danger',
};

const EMPLOYMENT_TYPE_LABEL = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  contract: 'Contract',
  intern: 'Intern',
};

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function tenure(dateOfJoining) {
  if (!dateOfJoining) return null;
  const start = new Date(dateOfJoining);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  if (years === 0) return `${remMonths} mo${remMonths === 1 ? '' : 's'}`;
  if (remMonths === 0) return `${years} yr${years === 1 ? '' : 's'}`;
  return `${years} yr${years === 1 ? '' : 's'} ${remMonths} mo${remMonths === 1 ? '' : 's'}`;
}

/**
 * Employment tab — read-only snapshot of the employee's official
 * record (Employee ID, Designation, Department, Team, Manager,
 * Joining Date, Employment Type/Status). Entirely presentational;
 * data comes from the `employee`/`employment` props already fetched
 * by the portal shell via GET /api/ess/overview — no calls here.
 *
 * Editing any of these fields requires EMPLOYEES_MANAGE (HR/Admin via
 * Employee Management), same rationale as the read-only sections in
 * MyProfileTab.jsx.
 */
export function EmploymentTab({ employee }) {
  if (!employee) return null;

  const employmentTenure = tenure(employee.date_of_joining);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Briefcase size={16} className="text-slate-500" />
            Employment Details
          </h3>
          <Badge variant={STATUS_BADGE_VARIANT[employee.employment_status] || 'default'}>
            {(employee.employment_status || 'unknown').replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          <DetailRow icon={Hash} label="Employee ID" value={employee.employee_code} />
          <DetailRow icon={BadgeCheck} label="Designation" value={employee.designation} />
          <DetailRow icon={Building2} label="Department" value={employee.department} />
          <DetailRow icon={Users} label="Reporting Manager" value={employee.reporting_manager_name} />
          <DetailRow
            icon={CalendarDays}
            label="Joining Date"
            value={formatDate(employee.date_of_joining)}
            subtext={employmentTenure ? `${employmentTenure} at the company` : null}
          />
          <DetailRow
            icon={Briefcase}
            label="Employment Type"
            value={EMPLOYMENT_TYPE_LABEL[employee.employment_type] || employee.employment_type}
          />
        </div>

        {employee.employment_status === 'terminated' && employee.date_of_exit && (
          <div className="mt-6 pt-6 border-t border-white/5">
            <DetailRow icon={CalendarDays} label="Date of Exit" value={formatDate(employee.date_of_exit)} />
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-500 px-1">
        These details are managed by HR/Admin. Contact them if anything here looks out of date.
      </p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, subtext }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-white/5 text-slate-500 mt-0.5">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-white">{value || '—'}</p>
        {subtext && <p className="text-xs text-slate-500 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

export default EmploymentTab;
