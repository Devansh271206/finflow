/**
 * Invitation Service
 * ------------------------------------------------------------------
 * Workspace join-by-invitation (PRD Section 30). Orchestrates:
 *   createInvitation()  — validate, generate token, store row, deliver
 *                         the email via Supabase Auth's built-in email
 *                         infrastructure (admin.inviteUserByEmail — the
 *                         only email channel this backend has; no SMTP
 *                         credentials are required beyond the Supabase
 *                         Auth email settings already used for
 *                         verification emails).
 *   getInvitationByToken() — public, read-only lookup for the join page.
 *   acceptInvitation()  — validate token + expiry + email match, create
 *                         the memberships row, flip status to accepted.
 *
 * Security model:
 *   - The token is a 32-byte CSPRNG hex string (64 chars) stored only in
 *     the invitations row and the email link. It is never logged.
 *   - Accepting requires the caller to be authenticated AS the invited
 *     email — the token alone is not sufficient, so a leaked link can't
 *     grant a third party access.
 *   - Tokens expire 7 days after sending; overdue tokens are lazily
 *     flipped to 'expired' and rejected.
 */

const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const invitationRepository = require("../repositories/invitationRepository");
const membershipRepository = require("../repositories/membershipRepository");
const roleRepository = require("../repositories/roleRepository");
const departmentRepository = require("../repositories/departmentRepository");
const { supabaseAdmin } = require("../config/supabase");

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validates role/department references for a new invitation. Role is
 * required; department optional and must belong to the workspace.
 */
async function validateInviteTargets({ workspaceId, roleId, departmentId }) {
  const roles = await roleRepository.listRoles();
  const targetRole = roles.find((r) => r.id === roleId);
  if (!targetRole) throw new ApiError(400, "Invalid role");

  if (departmentId) {
    const department = await departmentRepository.findByIdInWorkspace(
      departmentId,
      workspaceId
    );
    if (!department) throw new ApiError(404, "Department not found");
  }

  return targetRole;
}

/**
 * Create (or re-send) a workspace invitation.
 *
 * If the invitee is already an active member, this errors out. If a
 * valid pending invitation already exists for the same workspace+email,
 * the existing token is reused and the email re-sent (idempotent retry
 * of a failed first send) rather than stacking duplicates.
 *
 * @returns {Promise<{invitation: object, emailSent: boolean}>}
 */
async function createInvitation({ workspaceId, email, roleId, departmentId, invitedBy, frontendUrl }) {
  const normalisedEmail = String(email || "").trim().toLowerCase();
  if (!normalisedEmail) throw new ApiError(400, "email is required");

  const targetRole = await validateInviteTargets({ workspaceId, roleId, departmentId });

  // Don't invite someone who is already in the workspace.
  const existingProfile = await membershipRepository.findProfileByEmail(normalisedEmail);
  if (existingProfile) {
    const existing = await membershipRepository.findActiveMembership(
      existingProfile.id,
      workspaceId
    );
    if (existing) {
      throw new ApiError(400, "This user is already an active member of the workspace.");
    }
  }

  // Reuse a still-valid pending invitation (resend path) or create fresh.
  const existingPending = await invitationRepository.findPendingByWorkspaceAndEmail(
    workspaceId,
    normalisedEmail
  );

  let invitation = existingPending || null;
  let emailSent = false;

  if (!invitation) {
    const token = generateToken();
    invitation = await invitationRepository.create({
      workspace_id: workspaceId,
      email: normalisedEmail,
      role_id: roleId,
      department_id: departmentId || null,
      invited_by: invitedBy,
      token,
      status: "pending",
      expires_at: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
    });
  }

  // Deliver via Supabase Auth's invite email. redirectTo carries our own
  // token (and the email) so the frontend /invite page can accept it.
  const inviteUrl = `${frontendUrl}/invite?token=${invitation.token}&email=${encodeURIComponent(normalisedEmail)}`;

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    normalisedEmail,
    {
      redirectTo: inviteUrl,
      data: { full_name: null },
    }
  );

  if (inviteError) {
    throw new ApiError(
      502,
      `Invitation saved but the invitation email could not be sent (${inviteError.message}). ` +
        "Check Supabase Auth email settings, then try sending again — a pending invitation will be re-sent."
    );
  }

  emailSent = true;
  return { invitation, emailSent };
}

/**
 * Public read for the join page: returns enough to render the invitation
 * (workspace + company name, invited email, expiry) without exposing the
 * token or any membership internals.
 */
async function getInvitationByToken(token) {
  const invitation = await invitationRepository.findByToken(token);
  if (!invitation) {
    throw new ApiError(404, "Invitation not found.");
  }

  if (invitation.status === "accepted") {
    throw new ApiError(400, "This invitation has already been used.");
  }
  if (invitation.status === "cancelled") {
    throw new ApiError(400, "This invitation was cancelled.");
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await invitationRepository.update(invitation.id, { status: "expired" });
    throw new ApiError(400, "This invitation has expired.");
  }

  return {
    id: invitation.id,
    email: invitation.email,
    workspace: invitation.workspaces
      ? { id: invitation.workspaces.id, name: invitation.workspaces.name, companyName: invitation.workspaces.companies?.name || null }
      : null,
    role: invitation.roles ? { key: invitation.roles.key, name: invitation.roles.name } : null,
    expiresAt: invitation.expires_at,
  };
}

/**
 * Accept a pending invitation: creates the memberships row with the
 * invitation's role/department and marks the invitation accepted.
 * Requires the caller to be authenticated as the invited email.
 */
async function acceptInvitation(token, { userId, userEmail }) {
  const invitation = await invitationRepository.findByToken(token);
  if (!invitation) {
    throw new ApiError(404, "Invitation not found or already used.");
  }

  if (invitation.status === "accepted") {
    throw new ApiError(400, "This invitation has already been used.");
  }
  if (invitation.status === "cancelled") {
    throw new ApiError(400, "This invitation was cancelled.");
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await invitationRepository.update(invitation.id, { status: "expired" });
    throw new ApiError(400, "This invitation has expired.");
  }

  if (String(userEmail || "").trim().toLowerCase() !== invitation.email) {
    throw new ApiError(
      403,
      "This invitation was sent to a different email address. Sign in with the invited email to join."
    );
  }

  const existing = await membershipRepository.findActiveMembership(userId, invitation.workspace_id);
  if (existing) {
    throw new ApiError(400, "You are already a member of this workspace.");
  }

  // The invitee may have been auto-created by inviteUserByEmail and never
  // went through /api/auth/register, so their profile row may be missing.
  // Upsert a minimal one so member-list joins and profile lookups work.
  await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email: userEmail,
      full_name: userEmail.split("@")[0],
      currency: "₹",
      theme: "dark",
    },
    { onConflict: "id" }
  );

  const created = await membershipRepository.create({
    workspace_id: invitation.workspace_id,
    user_id: userId,
    role_id: invitation.role_id,
    department_id: invitation.department_id || null,
    status: "active",
  });

  await invitationRepository.update(invitation.id, {
    status: "accepted",
    accepted_at: new Date().toISOString(),
  });

  return {
    membership: created,
    workspace: invitation.workspaces
      ? { id: invitation.workspaces.id, name: invitation.workspaces.name, companyName: invitation.workspaces.companies?.name || null }
      : null,
    role: invitation.roles ? { key: invitation.roles.key, name: invitation.roles.name } : null,
  };
}

module.exports = {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
};
