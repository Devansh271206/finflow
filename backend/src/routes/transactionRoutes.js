const express = require("express");
const { body, param, query } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const validateRequest = require("../middleware/validateRequest");
const { upload } = require("../utils/upload");
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");

const router = express.Router();

// All transaction routes require authentication
router.use(protect);
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

router.get(
  "/",
  [
    query("type").optional().isIn(["income", "expense"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 200 }),
  ],
  validateRequest,
  getTransactions
);

router.get("/:id", [param("id").notEmpty()], validateRequest, getTransactionById);

router.post(
  "/",
  upload.single("receipt"),
  [
    body("amount").isFloat({ gt: 0 }).withMessage("Amount must be a positive number"),
    body("type").optional().isIn(["income", "expense"]),
    body("date").optional().isISO8601(),
  ],
  validateRequest,
  createTransaction
);

router.put(
  "/:id",
  upload.single("receipt"),
  [
    param("id").notEmpty(),
    body("amount").optional().isFloat({ gt: 0 }),
    body("type").optional().isIn(["income", "expense"]),
    body("date").optional().isISO8601(),
  ],
  validateRequest,
  updateTransaction
);

router.delete("/:id", [param("id").notEmpty()], validateRequest, deleteTransaction);

module.exports = router;
