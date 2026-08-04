const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  assignTeamLead,
  addTeamMember,
  removeTeamMember,
} = require("../controllers/teamController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

// Sprint 8 (PRD §15.20). Read access: Org Admin, Dept Lead (own
// department, scoped in teamController.js), Employee (own team) all
// hold teams.read per migration 013's seed. Query params validated the
// same way departmentRoutes.js / employeeRoutes.js validate their list
// endpoints.
router.get(
  "/",
  [
    query("department_id").optional({ nullable: true }).isUUID(),
    query("search").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    query("status").optional({ nullable: true }).isIn(["active", "inactive"]),
    query("sort_by").optional({ nullable: true }).isIn(["name", "created_at", "is_active"]),
    query("sort_order").optional({ nullable: true }).isIn(["asc", "desc"]),
    query("page").optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    query("page_size").optional({ nullable: true }).isInt({ min: 1, max: 100 }).toInt(),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAMS_READ),
  getTeams
);

router.get(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.TEAMS_READ),
  getTeamById
);

router.post(
  "/",
  [
    body("department_id").notEmpty().isUUID().withMessage("A valid department_id is required"),
    body("name").trim().notEmpty().withMessage("Team name is required"),
    body("description").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAMS_MANAGE),
  createTeam
);

router.patch(
  "/:id",
  [
    param("id").notEmpty(),
    body("name").optional().trim().notEmpty().withMessage("Team name cannot be empty"),
    body("description").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
    body("is_active").optional().isBoolean().withMessage("is_active must be a boolean"),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAMS_MANAGE),
  updateTeam
);

// Team Lead assignment. employee_id: null clears the lead (see
// teamService.js's assignLead) — same shape as departmentRoutes.js's
// PATCH /:id/head.
router.patch(
  "/:id/lead",
  [
    param("id").notEmpty(),
    body("employee_id").optional({ nullable: true }).isUUID().withMessage("employee_id must be a valid UUID"),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAMS_MANAGE),
  assignTeamLead
);

// Team membership (PRD §15.20 API design: POST /teams/:id/members,
// DELETE /teams/:id/members/:employeeId).
router.post(
  "/:id/members",
  [
    param("id").notEmpty(),
    body("employee_id").notEmpty().isUUID().withMessage("A valid employee_id is required"),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAMS_MANAGE),
  addTeamMember
);

router.delete(
  "/:id/members/:employeeId",
  [param("id").notEmpty(), param("employeeId").notEmpty().isUUID()],
  validateRequest,
  authorize(PERMISSIONS.TEAMS_MANAGE),
  removeTeamMember
);

// No top-level DELETE /:id route — teams are soft-deleted via
// PATCH { is_active: false } only, same convention as departments.

module.exports = router;