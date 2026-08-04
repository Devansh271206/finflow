/**
 * Report Service
 * ------------------------------------------------------------------
 * The generic engine every report in reportRegistry.js runs through.
 * No report gets its own bespoke fetch/filter/sort/paginate/export
 * code path — reportController.js only ever calls the functions here
 * with a reportId, and this file does the rest by reading the
 * matching registry entry.
 *
 * Data-fetch strategy: each source repository has a different filter/
 * pagination signature (employeeRepository always paginates and
 * returns {rows,total}; departmentRepository/teamRepository/
 * leaveRequestRepository return a plain array unless page+limit are
 * BOTH passed; transactionRepository always paginates and returns
 * {rows,count}; budgetRepository/vendorRepository/payrollRepository
 * return a plain array). Rather than special-casing each shape's
 * filter options (which would defeat the point of a generic engine),
 * this service always calls each repo's list method with NO
 * page/limit (so repos that support "return everything" do), then
 * applies search/filter/sort/pagination itself in JS over the full
 * row set. This keeps every report's filtering behavior identical
 * regardless of which repo backs it.
 *
 * Known scale limitation, stated plainly: PRD §46.9 requires report
 * generation over 1,000 rows to run as a Background Job (Section 44)
 * rather than synchronously. This sprint does not add a job queue —
 * transactionRepository.listForWorkspace() is capped at limit:1000 per
 * call below as a pragmatic guard, and workspaces with more than 1,000
 * transactions will see a truncated report rather than a timeout. This
 * is a known gap versus the PRD, not an oversight — flagging it here
 * rather than silently working around it, since the fix (a real job
 * queue) is out of scope for a single sprint on top of an existing
 * synchronous request/response API.
 */

const ApiError = require("../utils/ApiError");
const { getReportConfig, REPORT_IDS } = require("../config/reportRegistry");
const { writeCsv } = require("../utils/csvWriter");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const membershipPermissionGrantService = require("./membershipPermissionGrantService");
const membershipRepository = require("../repositories/membershipRepository");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");
const { resolveAdminHRUserIds } = require("./notificationRecipientHelpers");

const REPO_MAP = {
  employeeRepository: require("../repositories/employeeRepository"),
  departmentRepository: require("../repositories/departmentRepository"),
  teamRepository: require("../repositories/teamRepository"),
  leaveRequestRepository: require("../repositories/leaveRequestRepository"),
  payrollRepository: require("../repositories/payrollRepository"),
  transactionRepository: require("../repositories/transactionRepository"),
  budgetRepository: require("../repositories/budgetRepository"),
  vendorRepository: require("../repositories/vendorRepository"),
};

const TRANSACTION_FETCH_CAP = 1000; // see header comment above

// Resolve a possibly-nested "a.b.c" path off a row object. Used for
// joined-relation columns like "department.name".
function resolveValue(row, path) {
  if (!row) return undefined;
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), row);
}

function isoDay(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Whole-day-inclusive day count, matching leaveRequestService's own
// convention (both endpoints counted) — see reportRegistry.js's
// `derivedColumns` note on why this is computed here rather than read
// from a stored column.
function computeDayCountForRow(row) {
  const start = isoDay(row.start_date);
  const end = isoDay(row.end_date);
  if (!start || !end) return row.is_half_day ? 0.5 : 0;
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const days = Math.max(diffDays, 1);
  return row.is_half_day ? Math.max(days - 0.5, 0.5) : days;
}

async function fetchRawRows(config, workspaceId) {
  const repo = REPO_MAP[config.dataSource.repo];
  if (!repo || typeof repo[config.dataSource.method] !== "function") {
    throw new ApiError(500, `Report data source misconfigured for "${config.id}"`);
  }

  const options =
    config.dataSource.repo === "transactionRepository"
      ? { page: 1, limit: TRANSACTION_FETCH_CAP }
      : config.dataSource.repo === "payrollRepository"
      ? {} // listForWorkspace(workspaceId, { month, year }) — no filter = all periods
      : {};

  const result = await repo[config.dataSource.method](workspaceId, options);

  // Normalize the various return shapes down to a plain array.
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

async function applyEnrichment(config, workspaceId, rows) {
  if (!config.enrichWith) return rows;
  const { repo: repoName, method, mergeKey, resultKey } = config.enrichWith;
  const repo = REPO_MAP[repoName];
  if (!repo || typeof repo[method] !== "function") return rows;

  const enrichmentRows = await repo[method](workspaceId);
  // vendorRepository.getSpendByVendor() returns
  // [{ vendorId, vendorName, total }] — generalized here as a
  // Map keyed by the enrichment row's own id-like field so future
  // enrichWith sources aren't locked to that exact shape as long as
  // they expose *something* matching mergeKey's value.
  const byKey = new Map(
    (enrichmentRows || []).map((r) => [r.vendorId ?? r.id ?? r[mergeKey], r.total ?? r.value ?? r[resultKey]])
  );

  return rows.map((row) => ({
    ...row,
    [resultKey]: byKey.get(row[mergeKey]) ?? 0,
  }));
}

function applyDerivedColumns(config, rows) {
  if (!config.derivedColumns?.includes("day_count")) return rows;
  return rows.map((row) => ({ ...row, day_count: computeDayCountForRow(row) }));
}

async function applyPayrollRedaction(config, rows, membershipId) {
  if (config.id !== "payroll") return rows;
  if (!membershipId) {
    return rows.map((r) => ({ ...r, base_salary: null, net_salary: null }));
  }
  const granted = await membershipPermissionGrantService.hasActiveGrant(
    membershipId,
    PERMISSIONS.SALARY_READ_DEPARTMENT
  );
  if (granted) return rows;
  // PRD §13.3 — salary figures require the separately-grantable
  // salary.read_department grant even for roles that can see the
  // report's existence (PAYROLL_READ_AGGREGATE). Rather than denying
  // the whole report, blank just the sensitive columns — same
  // "row visible, salary redacted" pattern payrollService.js already
  // documents for row-level payroll reads.
  return rows.map((r) => ({ ...r, base_salary: null, net_salary: null }));
}

function applyFixedFilters(config, rows) {
  const fixed = config.dataSource.fixedFilters;
  if (!fixed) return rows;
  return rows.filter((row) =>
    Object.entries(fixed).every(([key, value]) => row[key] === value)
  );
}

function applyUserFilters(config, rows, query) {
  let result = rows;

  const search = (query.search || "").trim().toLowerCase();
  if (search) {
    const textColumns = config.columns.filter((c) => c.type === "text").map((c) => c.key);
    result = result.filter((row) =>
      textColumns.some((key) => String(resolveValue(row, key) ?? "").toLowerCase().includes(search))
    );
  }

  for (const filter of config.filters) {
    if (filter.type === "search") continue; // handled above via `search` query param
    const value = query[filter.key];
    if (value === undefined || value === null || value === "") continue;

    if (filter.type === "select") {
      result = result.filter((row) => String(resolveValue(row, filter.key)) === String(value));
    } else if (filter.type === "dateRange") {
      const from = query[`${filter.key}From`];
      const to = query[`${filter.key}To`];
      if (from) {
        const fromDate = isoDay(from);
        result = result.filter((row) => {
          const d = isoDay(resolveValue(row, filter.key));
          return d && fromDate && d >= fromDate;
        });
      }
      if (to) {
        const toDate = isoDay(to);
        result = result.filter((row) => {
          const d = isoDay(resolveValue(row, filter.key));
          return d && toDate && d <= toDate;
        });
      }
    }
  }

  return result;
}

function applySort(config, rows, sortBy, sortOrder) {
  const key = sortBy || config.defaultSort?.key;
  const direction = sortOrder || config.defaultSort?.direction || "asc";
  if (!key) return rows;

  const sorted = [...rows].sort((a, b) => {
    const av = resolveValue(a, key);
    const bv = resolveValue(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true });
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

function computeSummary(config, rows) {
  return (config.summaryCards || []).map((card) => {
    const values = rows
      .map((row) => Number(resolveValue(row, card.key)))
      .filter((v) => !Number.isNaN(v));

    let value;
    if (card.agg === "count") value = rows.length;
    else if (card.agg === "sum") value = values.reduce((a, b) => a + b, 0);
    else if (card.agg === "avg") value = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    else value = null;

    return { key: card.key, label: card.label, type: card.type, value };
  });
}

function projectRow(config, row) {
  const projected = {};
  for (const col of config.columns) {
    projected[col.key] = resolveValue(row, col.key);
  }
  return projected;
}

/**
 * Full pipeline shared by getReportData() and exportReportCsv():
 * fetch -> enrich -> derive -> redact -> fixed-filter -> user-filter -> sort.
 * Returns the FULL filtered/sorted row set (pre-pagination) — callers
 * decide whether to paginate (viewing) or not (export).
 */
async function buildFilteredRows(config, workspaceId, query, membershipId) {
  let rows = await fetchRawRows(config, workspaceId);
  rows = await applyEnrichment(config, workspaceId, rows);
  rows = applyDerivedColumns(config, rows);
  rows = await applyPayrollRedaction(config, rows, membershipId);
  rows = applyFixedFilters(config, rows);
  rows = applyUserFilters(config, rows, query);
  rows = applySort(config, rows, query.sortBy, query.sortOrder);
  return rows;
}

async function listAvailableReports(hasPermissionFn) {
  const configs = REPORT_IDS.map(getReportConfig);
  const allowed = [];
  for (const config of configs) {
    if (await hasPermissionFn(config.permission)) {
      allowed.push({ id: config.id, label: config.label, module: config.module });
    }
  }
  return allowed;
}

async function getReportData(reportId, workspaceId, query = {}, membershipId = null) {
  const config = getReportConfig(reportId);
  if (!config) throw new ApiError(404, `Unknown report "${reportId}"`);

  const filteredRows = await buildFilteredRows(config, workspaceId, query, membershipId);
  const summary = computeSummary(config, filteredRows);

  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 25, 1), 200);
  const start = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(start, start + pageSize).map((row) => projectRow(config, row));

  return {
    reportId: config.id,
    label: config.label,
    columns: config.columns,
    filters: config.filters,
    chart: config.chart,
    summary,
    rows: pageRows,
    total: filteredRows.length,
    page,
    pageSize,
  };
}

async function exportReportCsv(reportId, workspaceId, query = {}, membershipId = null) {
  const config = getReportConfig(reportId);
  if (!config) throw new ApiError(404, `Unknown report "${reportId}"`);

  const filteredRows = await buildFilteredRows(config, workspaceId, query, membershipId);
  const projected = filteredRows.map((row) => projectRow(config, row));
  const csv = writeCsv(projected, config.columns);

  // Resolves membershipId -> user_id since this function only ever
  // receives the acting membership's id, not their auth user id
  // directly (same shape every other reportService function in this
  // file uses) — a small extra lookup rather than threading a new
  // actorUserId parameter through every call site that invokes this.
  Promise.all([
    membershipId ? membershipRepository.findByIdInWorkspace(membershipId, workspaceId) : Promise.resolve(null),
    resolveAdminHRUserIds(workspaceId),
  ])
    .then(([actorMembership, recipientUserIds]) => {
      eventBusService.publish(EVENT_TYPES.REPORT_GENERATED, {
        workspaceId,
        actorUserId: actorMembership?.user_id || null,
        recipientUserIds,
        module: "Reports",
        resourceType: "report",
        resourceId: null,
        title: `Report generated: ${config.label}`,
        actionUrl: `/reports?reportId=${config.id}`,
        metadata: { reportId: config.id, rowCount: projected.length },
      });
    })
    .catch((err) => console.error("[reportService] Failed to resolve context for REPORT_GENERATED event:", err.message));

  return { csv, filename: `${config.id}-report-${new Date().toISOString().slice(0, 10)}.csv` };
}

module.exports = {
  listAvailableReports,
  getReportData,
  exportReportCsv,
};
