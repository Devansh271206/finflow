/**
 * Invitation Service
 * ------------------------------------------------------------------
 * Workspace join-by-invitation (PRD Section 30). Orchestrates:
 *   createInvitation()  — validate, generate token, store a SHA-256 hash,
 *                         deliver the invite email via emailService
 *                         (Resend/SMTP — see services/emailService.js).
 *   getInvitationByToken() — public, read-only lookup for the join page.
 *   acceptInvitation()  — validate token + expiry + email match, create
 *                         the memberships row, flip status to accepted.
 *
 * Security model (migration 022):
 *   - The token is a 32-byte CSPRNG hex string (64 chars). Only its
 *     SHA-256 hash (token_hash) is stored in the invitations table; the
 *     raw token exists only in the emailed link and in the in-memory
 *     service call that builds it. It is never logged and never persisted.
 *   - Accepting requires the caller to be authenticated AS the invited
 *     email — the token alone is not sufficient, so a leaked link can't
 *     grant a third party access.
 *   - Tokens expire 7 days after sending; overdue tokens are lazily
 *     flipped to 'expired' and rejected.
 *   - A re-send rotates the token (the old raw token can't be recovered
 *     from the hash), so each email carries a fresh single-use link.
 */

const ApiError = require("../utils/ApiError");
const { generateToken, hashToken } = require("../utils/tokens");
const emailService = require("./emailService");
const invitationRepository = require("../repositories/invitationRepository");
const membershipRepository = require("../repositories/membershipRepository");
const roleRepository = require("../repositories/roleRepository");
const departmentRepository = require("../repositories/departmentRepository");
const { supabaseAdmin } = require("../config/supabase");

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

/** Resolve the inviter's display name for the email body (best effort). */
async function getInviterName(userId) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.full_name) return null;
  return data.full_name;
}

/**
 * Create (or re-send) a workspace invitation.
 *
 * If the invitee is already an active member, this errors out. If a
 * valid pending invitation already exists for the same workspace+email,
 * the token is ROTATED (fresh hash + fresh expiry) and the email re-sent
 * — the previous raw token is unrecoverable from its hash, so each email
 * must carry a new single-use link.
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

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

  // Rotate the token on any still-pending invitation (resend path) or
  // create a fresh row when none exists.
  const existingPending = await invitationRepository.findPendingByWorkspaceAndEmail(
    workspaceId,
    normalisedEmail
  );

  let invitation;
  if (existingPending) {
    invitation = await invitationRepository.update(existingPending.id, {
      token_hash: tokenHash,
      invited_by: invitedBy,
      status: "pending",
      expires_at: expiresAt,
    });
  } else {
    invitation = await invitationRepository.create({
      workspace_id: workspaceId,
      email: normalisedEmail,
      role_id: roleId,
      department_id: departmentId || null,
      invited_by: invitedBy,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
    });
  }

  // Deliver via our own email service. The link carries the RAW token
  // (never the hash) so the /invite page can present it to the service.
  const inviteUrl = `${frontendUrl}/invite?token=${rawToken}&email=${encodeURIComponent(normalisedEmail)}`;

  const inviterName = await getInviterName(invitedBy);
  const workspace = invitation.workspaces || {};
  const result = await emailService.sendEmployeeInvitation({
    to: normalisedEmail,
    inviteUrl,
    organizationName: workspace.companies?.name || workspace.name || null,
    workspaceName: workspace.name || null,
    inviterName,
  });

  return { invitation, emailSent: result.emailSent };
}

/**
 * Public read for the join page: returns enough to render the invitation
 * (workspace + company name, invited email, expiry) without exposing the
 * token or any membership internals.
 */
async function getInvitationByToken(token) {
  const invitation = await invitationRepository.findByTokenHash(hashToken(token));
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
  const invitation = await invitationRepository.findByTokenHash(hashToken(token));
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

  // The invitee may have self-registered without ever going through the
  // full /api/auth/register profile upsert, so their profile row may be
  // missing. Upsert a minimal one so member-list joins and profile
  // lookups work.
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
