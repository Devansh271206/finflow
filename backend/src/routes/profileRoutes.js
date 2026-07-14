const express = require("express");
const { body } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { upload } = require("../utils/upload");
const { getProfile, updateProfile } = require("../controllers/profileController");

const router = express.Router();

router.use(protect);

router.get("/", getProfile);

router.put(
  "/",
  upload.single("avatar"),
  [
    body("fullName").optional().isString().trim(),
    body("currency").optional().isString(),
    body("theme").optional().isIn(["light", "dark"]),
    body("language").optional().isString(),
  ],
  validateRequest,
  updateProfile
);

module.exports = router;
