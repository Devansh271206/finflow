const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateRequest");
const { protect } = require("../middleware/authMiddleware");
const {
  register,
  login,
  logout,
  getMe,
  refreshToken,
} = require("../controllers/authController");

const router = express.Router();

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("A valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("fullName").optional().isString().trim(),
  ],
  validateRequest,
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("A valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validateRequest,
  login
);

router.post("/refresh", body("refresh_token").notEmpty(), validateRequest, refreshToken);

router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

module.exports = router;
