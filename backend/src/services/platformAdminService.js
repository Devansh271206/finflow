/**
 * Platform Admin Service
 * ------------------------------------------------------------------
 * Business logic over platformAdminRepository.js. Kept intentionally
 * thin for v1 — this sprint's brief is explicit: "Implement only the
 * architecture and essential functionality required for v1.0. Do NOT
 * over-engineer features planned for future releases."
 *
 * In scope for v1: organization list/detail/activate/suspend/delete,
 * platform-wide stats, org growth chart.
 *
 * Explicitly OUT of scope for v1 (left as clearly-labeled "coming
 * soon" nav entries on the frontend, no backend built for them):
 *   - Billing / subscription plan management
 *   - Feature flags
 *   - Platform health monitoring
 *   - Real audit-log storage (no audit_logs table exists to read —
 *     see platformAdminRepository.js's header note)
 */

const ApiError = require("../utils/ApiError");
const platformAdminRepository = require("../repositories/platformAdminRepository");

const VALID_STATUSES = ["active", "suspended"];

async function listOrganizations(filters = {}) {
  if (filters.status && !VALID_STATUSES.includes(filters.status)) {
    throw new ApiError(400, `Invalid status filter. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  return platformAdminRepository.listOrganizations(filters);
}

async function getOrganizationById(id) {
  const org = await platformAdminRepository.getOrganizationById(id);
  if (!org) throw new ApiError(404, "Organization not found.");
  return org;
}

async function activateOrganization(id) {
  const org = await getOrganizationById(id); // 404s if missing/already deleted
  if (org.status === "active") return org; // idempotent — no-op, not an error
  return platformAdminRepository.setOrganizationStatus(id, "active");
}

async function suspendOrganization(id) {
  const org = await getOrganizationById(id);
  if (org.status === "suspended") return org; // idempotent
  return platformAdminRepository.setOrganizationStatus(id, "suspended");
}

async function deleteOrganization(id) {
  await getOrganizationById(id); // 404s if missing/already deleted
  return platformAdminRepository.softDeleteOrganization(id);
}

async function getPlatformDashboard() {
  const [stats, growth] = await Promise.all([
    platformAdminRepository.getPlatformStats(),
    platformAdminRepository.getOrganizationGrowth(6),
  ]);
  return { stats, growth };
}

async function getPlatformAnalytics() {
  // v1: same underlying data as the dashboard, just a longer growth
  // window — a dedicated analytics data model (cohort/retention/usage
  // metrics) is exactly the kind of future-release scope this sprint
  // says not to build yet.
  const [stats, growth] = await Promise.all([
    platformAdminRepository.getPlatformStats(),
    platformAdminRepository.getOrganizationGrowth(12),
  ]);
  return { stats, growth };
}

module.exports = {
  listOrganizations,
  getOrganizationById,
  activateOrganization,
  suspendOrganization,
  deleteOrganization,
  getPlatformDashboard,
  getPlatformAnalytics,
};
