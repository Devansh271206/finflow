import React from 'react';
import { Search, X } from 'lucide-react';
import Input from '../ui/Input';
import { Select, SelectItem } from '../ui/Select';
import Button from '../ui/Button';

/**
 * Report Filter Panel
 * ------------------------------------------------------------------
 * Renders whatever filters the backend returned in
 * `GET /api/reports/:reportId`'s `filters` array (reportRegistry.js's
 * per-report `filters` config) — no report gets bespoke filter JSX,
 * matching this sprint's "generic, config-driven" requirement.
 *
 * `values` / `onChange` follow the same query-param shape
 * reportService.js's getReportData()/exportReportCsv() expect:
 *   - type 'search'    -> values.search
 *   - type 'select'    -> values[filter.key]
 *   - type 'dateRange' -> values[`${filter.key}From`] / [`${filter.key}To`]
 *
 * `selectOptions` is an optional map of { [filterKey]: string[] } for
 * 'select' filters — ReportViewer.jsx derives these from the currently
 * loaded rows (distinct values) since reportRegistry.js filters don't
 * ship a fixed option list for most of them (status/department/etc.
 * are workspace-specific). Falls back to a plain text Input if no
 * options are available yet (e.g. before the first page of data loads).
 */
export function ReportFilterPanel({ filters = [], values = {}, onChange, selectOptions = {}, onExport, exporting = false }) {
  const dateRangeFilters = filters.filter((f) => f.type === 'dateRange');
  const selectFilters = filters.filter((f) => f.type === 'select');
  const hasSearch = filters.some((f) => f.type === 'search');

  const setValue = (key, value) => {
    onChange({ ...values, [key]: value });
  };

  const clearAll = () => {
    onChange({});
  };

  const hasActiveFilters = Object.values(values).some((v) => v !== undefined && v !== null && v !== '');

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {hasSearch && (
          <div className="flex-1 min-w-[200px]">
            <Input
              icon={Search}
              placeholder="Search..."
              value={values.search || ''}
              onChange={(e) => setValue('search', e.target.value)}
            />
          </div>
        )}

        {selectFilters.map((filter) => {
          const options = selectOptions[filter.key] || [];
          return (
            <div key={filter.key} className="min-w-[160px]">
              <Select
                value={values[filter.key] || ''}
                onChange={(e) => setValue(filter.key, e.target.value)}
                placeholder={filter.label}
              >
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </Select>
            </div>
          );
        })}

        {dateRangeFilters.map((filter) => (
          <div key={filter.key} className="flex items-end gap-2">
            <Input
              type="date"
              label={`${filter.label} From`}
              value={values[`${filter.key}From`] || ''}
              onChange={(e) => setValue(`${filter.key}From`, e.target.value)}
            />
            <Input
              type="date"
              label={`${filter.label} To`}
              value={values[`${filter.key}To`] || ''}
              onChange={(e) => setValue(`${filter.key}To`, e.target.value)}
            />
          </div>
        ))}

        <div className="flex items-center gap-2 ml-auto">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X size={14} className="mr-1" /> Clear
            </Button>
          )}
          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport} loading={exporting}>
              Export CSV
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportFilterPanel;
