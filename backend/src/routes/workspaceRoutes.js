const express = require("express");
const { body, param } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
} = require("../controllers/workspaceController");

const router = express.Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get("/", getWorkspaces);

router.post(
  "/",
  [
    body("company_id").notEmpty().withMessage("company_id is required"),
    body("name").notEmpty().withMessage("Workspace name is required"),
  ],
  validateRequest,
  createWorkspace
);

router.get("/:id", [param("id").notEmpty()], validateRequest, getWorkspaceById);

router.patch(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.WORKSPACE_UPDATE),
  updateWorkspace
);

module.exports = router;
