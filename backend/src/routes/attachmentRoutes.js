const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { upload } = require("../utils/upload");
const {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
} = require("../controllers/attachmentController");

// mergeParams: true so :transactionId from the parent mount path
// (app.js mounts this at /api/transactions/:transactionId/attachments)
// is visible on req.params here.
const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(resolveWorkspace);

// Reuses the existing TRANSACTIONS_READ/TRANSACTIONS_EDIT permission
// keys rather than introducing new ATTACHMENTS_* keys — an attachment
// is part of a transaction's own record, not a separately-permissioned
// resource, same relationship as employee_documents to EMPLOYEES_READ/
// EMPLOYEES_MANAGE in Sprint 2.
router.get(
  "/",
  authorize(PERMISSIONS.TRANSACTIONS_READ),
  [param("transactionId").isUUID()],
  validateRequest,
  listAttachments
);

router.post(
  "/",
  authorize(PERMISSIONS.TRANSACTIONS_EDIT),
  upload.single("file"),
  [param("transactionId").isUUID()],
  validateRequest,
  uploadAttachment
);

router.delete(
  "/:attachmentId",
  authorize(PERMISSIONS.TRANSACTIONS_EDIT),
  [param("transactionId").isUUID(), param("attachmentId").isUUID()],
  validateRequest,
  deleteAttachment
);

module.exports = router;
