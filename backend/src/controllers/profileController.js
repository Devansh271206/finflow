/**
 * Profile Controller
 * ------------------------------------------------------------------
 * Table: profiles
 * Columns: id (= auth user id), full_name, avatar_url, currency, theme,
 *          language, privacy_mode, created_at, updated_at
 */

const { supabaseAdmin } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { uploadToSupabaseStorage } = require("../utils/upload");

// @desc    Get the authenticated user's profile (auto-creates a default one)
// @route   GET /api/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const { id: userId, email, user_metadata } = req.user;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to fetch profile", error.message);

  if (!data) {
    const defaultProfile = {
      id: userId,
      full_name: user_metadata?.full_name || email?.split("@")[0] || "User",
      avatar_url: user_metadata?.avatar_url || "",
      currency: "₹",
      theme: "dark",
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert([defaultProfile])
      .select("*")
      .single();

    if (insertError) {
      // Return the computed default even if persistence failed, so the
      // frontend still has something usable.
      return sendSuccess(res, { message: "Profile fetched successfully", data: defaultProfile });
    }

    return sendSuccess(res, { message: "Profile created and fetched successfully", data: inserted });
  }

  return sendSuccess(res, { message: "Profile fetched successfully", data });
});

// @desc    Update the authenticated user's profile
// @route   PUT /api/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { fullName, currency, theme, language, privacyMode } = req.body;

  let avatarUrl;
  if (req.file) {
    avatarUrl = await uploadToSupabaseStorage(supabaseAdmin, req.file, `avatars/${userId}`);
  }

  const payload = {
    id: userId,
    ...(fullName !== undefined && { full_name: fullName }),
    ...(avatarUrl !== undefined && { avatar_url: avatarUrl }),
    ...(currency !== undefined && { currency }),
    ...(theme !== undefined && { theme }),
    ...(language !== undefined && { language }),
    ...(privacyMode !== undefined && { privacy_mode: privacyMode }),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw new ApiError(500, "Failed to update profile", error.message);

  // Keep Supabase Auth user_metadata in sync so display name/avatar stay
  // consistent across the app.
  if (fullName !== undefined || avatarUrl !== undefined) {
    await supabaseAdmin.auth.admin
      .updateUserById(userId, {
        user_metadata: {
          ...(fullName !== undefined && { full_name: fullName }),
          ...(avatarUrl !== undefined && { avatar_url: avatarUrl }),
        },
      })
      .catch(() => null);
  }

  return sendSuccess(res, { message: "Profile updated successfully", data });
});

module.exports = { getProfile, updateProfile };
