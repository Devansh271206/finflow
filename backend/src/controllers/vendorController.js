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

  const { name, contactName, contactEmail, contactPhone, taxId } = req.body;
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Vendor name is required");
  }

  const existing = await vendorRepository.findByNameInWorkspace(req.workspace.id, trimmedName);
  if (existing) {
    throw new ApiError(409, "A vendor with this name already exists");
  }

  const vendor = await vendorRepository.create({
    workspace_id: req.workspace.id,
    name: trimmedName,
    contact_name: contactName || null,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
    tax_id: taxId || null,
    is_active: true,
  });

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

  const { name, contactName, contactEmail, contactPhone, taxId, is_active } = req.body;
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

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  const updated = await vendorRepository.update(req.params.id, payload);
  return sendSuccess(res, { message: "Vendor updated", data: updated });
});

module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
};