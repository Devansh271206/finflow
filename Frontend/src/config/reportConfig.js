/**
 * Report Config (frontend presentation layer)
 * ------------------------------------------------------------------
 * Sprint 11 — Enterprise Reporting & BI Platform.
 *
 * IMPORTANT: this file intentionally does NOT redeclare columns,
 * filters, or summaryCards — those already come back from
 * `GET /api/reports/:reportId` (see reportRegistry.js on the backend,
 * the single source of truth for report shape). Duplicating that here
 * would create a second config that silently drifts from the backend
 * whenever a report's columns change. This file only holds things the
 * API response has no business returning: icon components and other
 * JSX-adjacent presentation choices.
 *
 * REPORT_IDS below is a static mirror of backend REPORT_IDS purely for
 * offline reference (e.g. building a URL before the list call
 * resolves) — the authoritative, permission-filtered list always comes
 * from GET /api/reports at runtime; nothing here gates access.
 */

import {
  Users,
  Building2,
  UsersRound,
  CalendarClock,
  Wallet,
  Receipt,
  PiggyBank,
  ClipboardCheck,
  Truck,
} from 'lucide-react';

export const REPORT_IDS = [
  'employees',
  'departments',
  'teams',
  'leave',
  'payroll',
  'transactions',
  'budgets',
  'expenses',
  'vendors',
];

// icon + accent color per report, keyed by id (matches backend
// reportRegistry.js ids exactly — see REPORT_IDS above).
export const REPORT_PRESENTATION = {
  employees: { icon: Users, color: '#10b981' },
  departments: { icon: Building2, color: '#6366f1' },
  teams: { icon: UsersRound, color: '#8b5cf6' },
  leave: { icon: CalendarClock, color: '#f59e0b' },
  payroll: { icon: Wallet, color: '#ec4899' },
  transactions: { icon: Receipt, color: '#14b8a6' },
  budgets: { icon: PiggyBank, color: '#3b82f6' },
  expenses: { icon: ClipboardCheck, color: '#f97316' },
  vendors: { icon: Truck, color: '#ef4444' },
};

// Group labels for the ReportsHub grid — module comes back on each
// entry from GET /api/reports (config.module in reportRegistry.js);
// this just controls display order and section titles.
export const MODULE_GROUPS = [
  { module: 'employees', label: 'People' },
  { module: 'departments', label: 'People' },
  { module: 'teams', label: 'People' },
  { module: 'leave', label: 'People' },
  { module: 'payroll', label: 'Finance' },
  { module: 'transactions', label: 'Finance' },
  { module: 'budgets', label: 'Finance' },
  { module: 'expenses', label: 'Finance' },
  { module: 'vendors', label: 'Finance' },
];

export function getReportPresentation(reportId) {
  return REPORT_PRESENTATION[reportId] || { icon: Receipt, color: '#94a3b8' };
}

export function getGroupLabel(module) {
  return MODULE_GROUPS.find((g) => g.module === module)?.label || 'Other';
}

// Maps a backend chart config ({ type, xKey, yKey }) to the Recharts
// component name ReportChart.jsx should render. Kept here (not
// hardcoded in the component) so a new chart type only needs one
// switch-like lookup updated in one place.
export const CHART_TYPE_COMPONENT = {
  bar: 'BarChart',
  pie: 'PieChart',
  line: 'LineChart',
};

// Palette for multi-slice charts (pie segments, multi-series bars),
// reusing the same accent colors as REPORT_PRESENTATION above so a
// report's chart visually matches its hub card.
export const CHART_COLORS = [
  '#10b981', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899',
  '#14b8a6', '#3b82f6', '#f97316', '#ef4444', '#94a3b8',
];
