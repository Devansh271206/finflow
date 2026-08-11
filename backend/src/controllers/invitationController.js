/**
 * Invitation Controller
 * ------------------------------------------------------------------
 * Workspace join-by-invitation endpoints (PRD Section 30).
 *
 *   POST /api/invitations            — create/send an invitation
 *                                      (auth + resolveWorkspace +
 *                                      authorize team.invite)
 *   GET  /api/invitations/:token     — public lookup for the /invite page
 *   POST /api/invitations/:token/accept — authenticated accept
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const invitationService = require("../services/invitationService");

// @desc    Create a workspace invitation and email it to the invitee
// @route   POST /api/invitations
// @access  Admin / Finance-Ops (team.invite)
const createInvitation = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { email, role_id, department_id } = req.body;
  if (!email) throw new ApiError(400, "email is required");
  if (!role_id) throw new ApiError(400, "role_id is required");

  const { invitation, emailSent } = await invitationService.createInvitation({
    workspaceId: req.workspace.id,
    email,
    roleId: role_id,
    departmentId: department_id || null,
    invitedBy: req.user.id,
    frontendUrl: env.FRONTEND_URL,
  });

  return sendSuccess(res, {
    statusCode: emailSent ? 201 : 202,
    message: emailSent
      ? `Invitation sent to ${invitation.email}.`
      : `Invitation created for ${invitation.email}.`,
    data: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.roles,
      workspace: { id: invitation.workspace_id },
    },
  });
});

// @desc    Public invitation lookup (join page)
// @route   GET /api/invitations/:token
// @access  Public (token is the secret)
const getInvitationByToken = asyncHandler(async (req, res) => {
  const info = await invitationService.getInvitationByToken(req.params.token);
  return sendSuccess(res, { message: "Invitation found", data: info });
});

// @desc    Accept an invitation and join the workspace
// @route   POST /api/invitations/:token/accept
// @access  Private (must be signed in as the invited email)
const acceptInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.acceptInvitation(req.params.token, {
    userId: req.user.id,
    userEmail: req.user.email,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: `You have joined ${result.workspace?.name || "the workspace"}.`,
    data: result,
  });
});

module.exports = { createInvitation, getInvitationByToken, acceptInvitation };
