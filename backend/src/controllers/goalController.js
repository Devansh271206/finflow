/**
 * Goal Controller
 * ------------------------------------------------------------------
 * Table: goals
 * Columns: id, user_id, title, target_amount, saved_amount, deadline,
 *          status, category, milestones, created_at, updated_at
 */

const { supabaseAdmin } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { applyWorkspaceScope, workspaceIdForInsert } = require("../utils/workspaceScope");

// @desc    Get all goals for the authenticated user
// @route   GET /api/goals
// @access  Private
const getGoals = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let query = supabaseAdmin
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  query = applyWorkspaceScope(query, req);

  const { data, error } = await query;

  if (error) throw new ApiError(500, "Failed to fetch goals", error.message);

  return sendSuccess(res, { message: "Goals fetched successfully", data: data || [] });
});

// @desc    Get a single goal
// @route   GET /api/goals/:id
// @access  Private
const getGoalById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to fetch goal", error.message);
  if (!data) throw new ApiError(404, "Goal not found");

  return sendSuccess(res, { message: "Goal fetched successfully", data });
});

// @desc    Create a new goal
// @route   POST /api/goals
// @access  Private
const createGoal = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, target, deadline, category, milestones } = req.body;

  const payload = {
    user_id: userId,
    title: name,
    target_amount: Number(target || 0),
    saved_amount: 0,
    deadline: deadline || null,
    status: "active",
    category: category || "General",
    ...(milestones && { milestones }),
    workspace_id: workspaceIdForInsert(req),
  };

  const { data, error } = await supabaseAdmin
    .from("goals")
    .insert([payload])
    .select("*")
    .single();

  if (error) throw new ApiError(500, "Failed to create goal", error.message);

  return sendSuccess(res, { statusCode: 201, message: "Goal created successfully", data });
});

// @desc    Update a goal (including adding funds / changing status)
// @route   PUT /api/goals/:id
// @access  Private
const updateGoal = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, target, category, deadline, status, savedAmount, addFunds } = req.body;

  const payload = {
    ...(name !== undefined && { title: name }),
    ...(target !== undefined && { target_amount: Number(target) }),
    ...(category !== undefined && { category }),
    ...(deadline !== undefined && { deadline }),
    ...(status !== undefined && { status }),
    updated_at: new Date().toISOString(),
  };

  // Support either setting an absolute saved_amount, or incrementing it
  // (e.g. "Add Funds" action from the Goals page).
  if (savedAmount !== undefined) {
    payload.saved_amount = Number(savedAmount);
  } else if (addFunds !== undefined) {
    const { data: current, error: loadError } = await supabaseAdmin
      .from("goals")
      .select("saved_amount")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (loadError) throw new ApiError(500, "Failed to load goal", loadError.message);
    if (!current) throw new ApiError(404, "Goal not found");

    payload.saved_amount = Number(current.saved_amount || 0) + Number(addFunds);
  }

  const { data, error } = await supabaseAdmin
    .from("goals")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to update goal", error.message);
  if (!data) throw new ApiError(404, "Goal not found");

  return sendSuccess(res, { message: "Goal updated successfully", data });
});

// @desc    Delete a goal
// @route   DELETE /api/goals/:id
// @access  Private
const deleteGoal = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to delete goal", error.message);
  if (!data) throw new ApiError(404, "Goal not found");

  return sendSuccess(res, { message: "Goal deleted successfully", data: { id } });
});

module.exports = { getGoals, getGoalById, createGoal, updateGoal, deleteGoal };
