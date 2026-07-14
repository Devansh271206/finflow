const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const {
  getRoles,
  getPermissions,
  getMyPermissions,
} = require("../controllers/roleController");

const router = express.Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get("/", getRoles);
router.get("/permissions", getPermissions);
router.get("/me", getMyPermissions);

module.exports = router;
