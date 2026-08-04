const express = require("express");
const { query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { getActivity } = require("../controllers/activityController");

const router = express.Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get(
  "/",
  [
    query("page").optional({ nullable: true }).isInt({ min: 1 }),
    query("limit").optional({ nullable: true }).isInt({ min: 1, max: 100 }),
    query("search").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    query("module").optional({ nullable: true }).isString().trim(),
  ],
  validateRequest,
  authorize(PERMISSIONS.ACTIVITY_READ),
  getActivity
);

module.exports = router;
