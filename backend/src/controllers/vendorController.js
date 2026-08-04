/**
 * Vendor Controller
 * ------------------------------------------------------------------
 * Table: vendors
 * Columns: id, workspace_id, name, contact_name, contact_email,
 *          contact_phone, tax_id, is_active, created_at, updated_at
 *
 * Route protection (see vendorRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.VENDORS_*)
 *
 * Same soft-delete-only rule as departments: a vendor referenced by
 * transaction history is never hard-deleted, only deactivated via
 * PATCH { is_active: false }. No DELETE route exists.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const vendorRepository = require("../repositories/vendorRepository");
const departmentRepository = require("../repositories/departmentRepository");
const eventBusService = require("../services/eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");
const { resolveAdminHRUserIds } = require("../services/notificationRecipientHelpers");

/**
 * Confirms ownerDepartmentId (if provided) belongs to the caller's
 * workspace — same assert-first pattern employeeService.js already
 * uses for departmentId. Inlined here rather than a new vendorService
 * file, matching this controller's existing style (no service layer
 * was ever introduced for vendors — business logic has always lived
 * directly in the controller here).
 */
async function assertOwnerDepartmentInWorkspace(departmentId, workspaceId) {
  if (!departmentId) return;
  const department = await departmentRepository.findByIdInWorkspace(departmentId, workspaceId);
  if (!department) throw new ApiError(404, "Owner department not found");
}

// @desc    List all vendors in the resolved workspace (active + inactive;
//          frontend distinguishes via is_active badge)
// @route   GET /api/vendors
// @access  Member (vendors.read)
const getVendors = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const vendors = await vendorRepository.listByWorkspace(req.workspace.id);
  return sendSuccess(res, { message: "Vendors fetched", data: vendors });
});

// @desc    Get a single vendor (must belong to the resolved workspace)
// @route   GET /api/vendors/:id
// @access  Member (vendors.read)
const getVendorById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const vendor = await vendorRepository.findByIdInWorkspace(req.params.id, req.workspace.id);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  return sendSuccess(res, { message: "Vendor fetched", data: vendor });
});

// @desc    Create a vendor in the resolved workspace
// @route   POST /api/vendors
// @access  Admin / Finance-Ops (vendors.manage)
const createVendor = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const {
    name,
    contactName,
    contactEmail,
    contactPhone,
    taxId,
    isSubscription,
    billingCycle,
    autoRenew,
    licenseCount,
    licenseUsed,
    functionalTag,
    ownerDepartmentId,
    nextBillingDate,
  } = req.body;
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Vendor name is required");
  }

  const existing = await vendorRepository.findByNameInWorkspace(req.workspace.id, trimmedName);
  if (existing) {
    throw new ApiError(409, "A vendor with this name already exists");
  }

  await assertOwnerDepartmentInWorkspace(ownerDepartmentId, req.workspace.id);

  const vendor = await vendorRepository.create({
    workspace_id: req.workspace.id,
    name: trimmedName,
    contact_name: contactName || null,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
    tax_id: taxId || null,
    is_active: true,
    is_subscription: Boolean(isSubscription),
    billing_cycle: billingCycle || null,
    auto_renew: Boolean(autoRenew),
    license_count: licenseCount ?? null,
    license_used: licenseUsed ?? null,
    functional_tag: functionalTag || null,
    owner_department_id: ownerDepartmentId || null,
    next_billing_date: nextBillingDate || null,
  });

  resolveAdminHRUserIds(req.workspace.id)
    .then((recipientUserIds) => {
      eventBusService.publish(EVENT_TYPES.VENDOR_ADDED, {
        workspaceId: req.workspace.id,
        actorUserId: req.user.id,
        recipientUserIds,
        module: "Vendor",
        resourceType: "vendor",
        resourceId: vendor.id,
        title: `Vendor "${trimmedName}" was added`,
        actionUrl: `/vendors?id=${vendor.id}`,
        metadata: { isSubscription: Boolean(isSubscription) },
      });
    })
    .catch((err) => console.error("[vendorController] Failed to resolve recipients for VENDOR_ADDED event:", err.message));

  return sendSuccess(res, { statusCode: 201, message: "Vendor created", data: vendor });
});

// @desc    Edit and/or activate/deactivate a vendor. Soft-delete only.
// @route   PATCH /api/vendors/:id
// @access  Admin / Finance-Ops (vendors.manage)
const updateVendor = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const existing = await vendorRepository.findByIdInWorkspace(req.params.id, req.workspace.id);
  if (!existing) throw new ApiError(404, "Vendor not found");

  const {
    name,
    contactName,
    contactEmail,
    contactPhone,
    taxId,
    is_active,
    isSubscription,
    billingCycle,
    autoRenew,
    licenseCount,
    licenseUsed,
    lastUsedAt,
    functionalTag,
    ownerDepartmentId,
    nextBillingDate,
    status,
  } = req.body;
  const payload = {};

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new ApiError(400, "Vendor name cannot be empty");
    }
    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await vendorRepository.findByNameInWorkspace(req.workspace.id, trimmedName);
      if (duplicate) {
        throw new ApiError(409, "A vendor with this name already exists");
      }
    }
    payload.name = trimmedName;
  }

  if (contactName !== undefined) payload.contact_name = contactName;
  if (contactEmail !== undefined) payload.contact_email = contactEmail;
  if (contactPhone !== undefined) payload.contact_phone = contactPhone;
  if (taxId !== undefined) payload.tax_id = taxId;
  if (is_active !== undefined) payload.is_active = Boolean(is_active);
  if (isSubscription !== undefined) payload.is_subscription = Boolean(isSubscription);
  if (billingCycle !== undefined) payload.billing_cycle = billingCycle;
  if (autoRenew !== undefined) payload.auto_renew = Boolean(autoRenew);
  if (licenseCount !== undefined) payload.license_count = licenseCount;
  if (licenseUsed !== undefined) payload.license_used = licenseUsed;
  if (lastUsedAt !== undefined) payload.last_used_at = lastUsedAt;
  if (functionalTag !== undefined) payload.functional_tag = functionalTag;
  if (nextBillingDate !== undefined) payload.next_billing_date = nextBillingDate;
  if (status !== undefined) payload.status = status;

  if (ownerDepartmentId !== undefined) {
    await assertOwnerDepartmentInWorkspace(ownerDepartmentId, req.workspace.id);
    payload.owner_department_id = ownerDepartmentId || null;
  }

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  const updated = await vendorRepository.update(req.params.id, payload);
  return sendSuccess(res, { message: "Vendor updated", data: updated });
});

// @desc    List vendors flagged as subscriptions (is_subscription = true).
//          A filtered view of the vendors table, not a separate resource
//          (PRD §15.7).
// @route   GET /api/vendors/subscriptions
// @access  Member (vendors.read)
const getSubscriptions = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const subscriptions = await vendorRepository.listByWorkspace(req.workspace.id, {
    subscriptionsOnly: true,
  });
  return sendSuccess(res, { message: "Subscriptions fetched", data: subscriptions });
});

// @desc    Lightweight vendor KPIs: spend concentration (top 5 vendors'
//          share of total vendor spend) and upcoming renewal risks
//          (PRD KPI table: "Vendor Concentration", "Renewal Risk").
//          Deliberately scoped to what vendors+transactions alone can
//          answer — the fuller Executive/Finance dashboards (payroll,
//          budget context) are Sprint 5 scope, not duplicated here.
// @route   GET /api/vendors/analytics
// @access  Member (vendors.read)
const getVendorAnalytics = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const [vendors, renewalRisks, spendByVendor] = await Promise.all([
    vendorRepository.listByWorkspace(req.workspace.id),
    vendorRepository.findRenewalRisks(req.workspace.id, 30),
    vendorRepository.getSpendByVendor(req.workspace.id),
  ]);

  const totalSpend = spendByVendor.reduce((sum, row) => sum + Number(row.total), 0);
  const topFive = [...spendByVendor].sort((a, b) => b.total - a.total).slice(0, 5);
  const topFiveTotal = topFive.reduce((sum, row) => sum + Number(row.total), 0);
  const vendorConcentration = totalSpend > 0 ? (topFiveTotal / totalSpend) * 100 : 0;

  return sendSuccess(res, {
    message: "Vendor analytics fetched",
    data: {
      totalVendors: vendors.length,
      vendorsWithOwner: vendors.filter((v) => v.owner_department_id).length,
      vendorConcentrationPercent: Math.round(vendorConcentration * 100) / 100,
      topFiveVendorsBySpend: topFive,
      renewalRisks,
    },
  });
});

module.exports = {
  getVendors,
  getVendorById,
  getSubscriptions,
  getVendorAnalytics,
  createVendor,
  updateVendor,
};