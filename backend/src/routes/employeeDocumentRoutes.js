const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { upload } = require("../utils/upload");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const employeeRepository = require("../repositories/employeeRepository");
const {
  listDocuments,
  uploadDocument,
  deleteDocument,
} = require("../controllers/employeeDocumentController");

// mergeParams: true so :employeeId from the parent mount path
// (app.js mounts this at /api/employees/:employeeId/documents) is
// visible on req.params here.
const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(resolveWorkspace);

// Sprint 13 (Employee Self-Service Portal): read access is now allowed
// either via the existing EMPLOYEES_READ role permission (HR/Admin/
// Manager viewing anyone) OR when the caller is looking at their own
// employee record (My Documents tab). This mirrors the "own vs all"
// split already used for leave/payroll (see permissionRegistry.js)
// rather than adding a new permission key. Write actions (upload/
// delete) intentionally remain EMPLOYEES_MANAGE only — self-service is
// read/download only per PRD.
const allowSelfOrEmployeesRead = asyncHandler(async (req, res, next) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const ownRecord = await employeeRepository.findByUserIdInWorkspace(
    req.user.id,
    req.workspace.id
  );

  if (ownRecord && ownRecord.id === employeeId) {
    return next();
  }

  return authorize(PERMISSIONS.EMPLOYEES_READ)(req, res, next);
});

router.get(
  "/",
  [param("employeeId").isUUID()],
  validateRequest,
  allowSelfOrEmployeesRead,
  listDocuments
);

// upload.single("file") mirrors the existing multer usage pattern from
// transaction receipt uploads — multipart/form-data with a single
// "file" field plus a documentType form field.
router.post(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  upload.single("file"),
  [
    param("employeeId").isUUID(),
    body("documentType")
      .trim()
      .notEmpty()
      .isIn(["offer_letter", "id_proof", "contract", "certification", "other"])
      .withMessage("documentType must be one of: offer_letter, id_proof, contract, certification, other"),
  ],
  validateRequest,
  uploadDocument
);

router.delete(
  "/:documentId",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  [param("employeeId").isUUID(), param("documentId").isUUID()],
  validateRequest,
  deleteDocument
);

module.exports = router;
