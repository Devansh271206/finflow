/**
 * Approval Service
 * ------------------------------------------------------------------
 * The actual expense approval state machine (PRD §15.5 / §18.1):
 *
 *   draft -> submitted -> under_review -> approved -> reimbursed
 *                                       \-> rejected (terminal, from
 *                                           either submitted or
 *                                           under_review)
 *
 * Two-step escalation: a Dept Lead's approve() moves
 * submitted -> under_review; Finance's approve() moves
 * under_review -> approved. WHO is allowed to perform each step is
 * checked here (not just role, but "this Dept Lead's own department"),
 * since authorize(PERMISSIONS.APPROVALS_ACT) only confirms the caller
 * has approval rights of SOME kind — it can't know which step of a
 * two-step process a given role is allowed to perform.
 *
 * KNOWN GAP, not silently resolved: PRD's RBAC row says Dept Lead can
 * approve "own dept, within limit" — no numeric limit is specified
 * anywhere in the PRD. This service enforces the department half (a
 * well-defined rule) but NOT an amount threshold — that would require
 * either a hardcoded number nobody asked for, or new schema (a
 * configurable per-workspace limit) that wasn't requested. Flagging
 * this again here, at the point where it would actually bite, not just
 * in the migration comment.
 */

const approvalRepository = require("../repositories/approvalRepository");
const transactionRepository = require("../repositories/transactionRepository");
const membershipRepository = require("../repositories/membershipRepository");
const ApiError = require("../utils/ApiError");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");

/**
 * Sprint 14: resolves who should be notified when an expense is
 * submitted — mirrors assertActorCanActOnStep's own "dept_lead" step
 * definition (Admin, or the Dept Lead of this transaction's own
 * department) plus Finance (who acts at the second step), so the
 * notification recipient set matches exactly who is actually allowed
 * to act on it, no more and no less.
 */
async function resolveExpenseApproverUserIds(workspaceId, departmentId) {
  const members = await membershipRepository.listByWorkspace(workspaceId);
  return (members || [])
    .filter((m) => {
      if (m.status !== "active") return false;
      const roleKey = String(m.roles?.key || "").toUpperCase();
      if (roleKey === "ADMIN" || roleKey === "FINANCE") return true;
      if (roleKey === "DEPARTMENT_LEAD" && m.department_id === departmentId) return true;
      return false;
    })
    .map((m) => m.user_id)
    .filter(Boolean);
}

/**
 * Confirms the caller's membership is allowed to act on THIS
 * transaction at THIS step. roleKey/departmentId come from
 * req.membership, the same shape employeeController.js already reads
 * from for its own Dept Lead scoping.
 */
function assertActorCanActOnStep(transaction, membership, step) {
  if (!membership) {
    throw new ApiError(403, "No membership resolved for this workspace");
  }

  const isAdmin = membership.roleKey === "ADMIN";
  const isFinance = membership.roleKey === "FINANCE";
  const isDeptLead = membership.roleKey === "DEPARTMENT_LEAD";

  if (step === "dept_lead") {
    if (isAdmin) return; // Admin can act at any step, per PRD RBAC "Approvals | Approve: Admin ✅"
    if (isDeptLead && membership.departmentId === transaction.department_id) return;
    throw new ApiError(
      403,
      "Only the transaction's own department lead (or an Admin) can approve at this step"
    );
  }

  if (step === "finance") {
    if (isAdmin || isFinance) return;
    throw new ApiError(403, "Only Finance (or an Admin) can approve at this step");
  }

  throw new ApiError(400, `Unknown approval step "${step}"`);
}

/**
 * Determines which step ('dept_lead' or 'finance') an approve/reject
 * action against the transaction's CURRENT approval_status represents,
 * or throws if the transaction isn't in a state where that action is
 * valid at all.
 */
function resolveStepForCurrentStatus(transaction) {
  if (transaction.approval_status === "submitted") return "dept_lead";
  if (transaction.approval_status === "under_review") return "finance";
  throw new ApiError(
    409,
    `Transaction cannot be approved/rejected from its current status (${transaction.approval_status ?? "none"})`
  );
}

/**
 * Approval actions are workspace-scoped, not restricted to the
 * transaction's original creator — a Dept Lead approving isn't the
 * same person who submitted the expense. This deliberately does NOT
 * use transactionRepository.findByIdForUser(id, userId, workspaceId),
 * which requires a matching user_id; it uses the dedicated
 * workspace-only lookup below instead (added to transactionRepository.js
 * this sprint specifically for approval actions).
 */
async function assertTransactionInWorkspace(transactionId, workspaceId) {
  const found = await transactionRepository.findByIdInWorkspaceForApproval(
    transactionId,
    workspaceId
  );
  if (!found) throw new ApiError(404, "Transaction not found");
  return found;
}

/**
 * Employee submits a draft expense for approval.
 * draft -> submitted. Only the transaction's own creator (or Admin) can
 * submit it — enforced by the controller checking created_by/user_id,
 * not here, since that's an ownership check rather than an
 * approval-step check.
 */
async function submit(transactionId, workspaceId) {
  const transaction = await assertTransactionInWorkspace(transactionId, workspaceId);

  if (transaction.approval_status !== "draft") {
    throw new ApiError(
      409,
      `Only a draft transaction can be submitted (current status: ${transaction.approval_status ?? "none"})`
    );
  }

  const updated = await transactionRepository.updateForUser(
    transactionId,
    transaction.user_id,
    { approval_status: "submitted" },
    workspaceId
  );

  resolveExpenseApproverUserIds(workspaceId, transaction.department_id)
    .then((recipientUserIds) => {
      eventBusService.publish(EVENT_TYPES.EXPENSE_SUBMITTED, {
        workspaceId,
        actorUserId: transaction.user_id,
        recipientUserIds,
        module: "Expense",
        resourceType: "transaction",
        resourceId: transactionId,
        title: "An expense was submitted for approval",
        message: transaction.title || null,
        actionUrl: `/expense-approvals?id=${transactionId}`,
        metadata: { amount: transaction.amount, departmentId: transaction.department_id },
      });
    })
    .catch((err) => console.error("[approvalService] Failed to resolve expense approvers for event:", err.message));

  return updated;
}

async function approve(transactionId, workspaceId, membership, decidedBy, notes) {
  const transaction = await assertTransactionInWorkspace(transactionId, workspaceId);
  const step = resolveStepForCurrentStatus(transaction);
  assertActorCanActOnStep(transaction, membership, step);

  await approvalRepository.create({
    transaction_id: transactionId,
    workspace_id: workspaceId,
    step,
    decision: "approved",
    decided_by: decidedBy,
    notes: notes || null,
  });

  const nextStatus = step === "dept_lead" ? "under_review" : "approved";

  const updated = await transactionRepository.updateForUser(
    transactionId,
    transaction.user_id,
    { approval_status: nextStatus, approved_by: decidedBy },
    workspaceId
  );

  // PRD §18.1: "approval_status=approved, trigger budget.amount_spent
  // update" — budgetRepository.computeSpendForBudgets() already reads
  // approval_status live on every call (Sprint 4 fix, this same
  // sprint), so there is nothing to separately "trigger" here — the
  // very next budget read will already reflect this transaction. No
  // extra write needed; noting this explicitly so it's clear the PRD's
  // sequence-diagram step is satisfied by the read-time fix, not
  // ignored.

  if (nextStatus === "approved") {
    eventBusService.publish(EVENT_TYPES.EXPENSE_APPROVED, {
      workspaceId,
      actorUserId: decidedBy,
      recipientUserIds: [transaction.user_id],
      module: "Expense",
      resourceType: "transaction",
      resourceId: transactionId,
      title: "Your expense was approved",
      message: transaction.title || null,
      actionUrl: `/transactions?id=${transactionId}`,
      metadata: { amount: transaction.amount },
    });
  }

  return updated;
}

async function reject(transactionId, workspaceId, membership, decidedBy, notes) {
  const transaction = await assertTransactionInWorkspace(transactionId, workspaceId);
  const step = resolveStepForCurrentStatus(transaction);
  assertActorCanActOnStep(transaction, membership, step);

  if (!notes || !notes.trim()) {
    throw new ApiError(400, "A reason is required when rejecting a transaction");
  }

  await approvalRepository.create({
    transaction_id: transactionId,
    workspace_id: workspaceId,
    step,
    decision: "rejected",
    decided_by: decidedBy,
    notes: notes.trim(),
  });

  const updated = await transactionRepository.updateForUser(
    transactionId,
    transaction.user_id,
    { approval_status: "rejected", approved_by: decidedBy },
    workspaceId
  );

  eventBusService.publish(EVENT_TYPES.EXPENSE_REJECTED, {
    workspaceId,
    actorUserId: decidedBy,
    recipientUserIds: [transaction.user_id],
    module: "Expense",
    resourceType: "transaction",
    resourceId: transactionId,
    title: "Your expense was rejected",
    message: notes.trim(),
    actionUrl: `/transactions?id=${transactionId}`,
    metadata: { amount: transaction.amount },
  });

  return updated;
}

/**
 * Finance marks an approved expense as reimbursed. approved ->
 * reimbursed. Terminal — no further transitions.
 */
async function reimburse(transactionId, workspaceId, membership) {
  const transaction = await assertTransactionInWorkspace(transactionId, workspaceId);

  const isAdmin = membership && membership.roleKey === "ADMIN";
  const isFinance = membership && membership.roleKey === "FINANCE";
  if (!isAdmin && !isFinance) {
    throw new ApiError(403, "Only Finance (or an Admin) can mark a transaction as reimbursed");
  }

  if (transaction.approval_status !== "approved") {
    throw new ApiError(
      409,
      `Only an approved transaction can be reimbursed (current status: ${transaction.approval_status ?? "none"})`
    );
  }

  return transactionRepository.updateForUser(
    transactionId,
    transaction.user_id,
    { approval_status: "reimbursed" },
    workspaceId
  );
}

module.exports = { submit, approve, reject, reimburse };
