/**
 * Activity Controller
 * ------------------------------------------------------------------
 * Sprint 14. Exposes the organization-wide Activity Feed. Role-scoped
 * visibility (Admin=all, Manager=dept/team, Employee=own) is resolved
 * inside activityService.listActivity() (see that file's
 * resolveActorScope) — this controller just passes through the
 * caller's identity and role, same thin-HTTP-layer posture every
 * other controller in this codebase follows.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const activityService = require("../services/activityService");

// @desc    Role-scoped, paginated, filterable organization activity feed.
// @route   GET /api/activity?page=&limit=&search=&module=
// @access  Member (activity.read)
const getActivity = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { page, limit, search, module } = req.query;

  const result = await activityService.listActivity(req.workspace.id, {
    userId: req.user.id,
    roleKey: req.membership?.roleKey,
    page,
    limit,
    search,
    module,
  });

  return sendSuccess(res, {
    message: "Activity feed fetched",
    data: result.data,
    meta: { total: result.total },
  });
});

module.exports = { getActivity };
