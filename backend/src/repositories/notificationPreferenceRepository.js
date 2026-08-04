/**
 * Notification Preference Repository
 * ------------------------------------------------------------------
 * Data-access layer for `notification_preferences` (migration 019).
 * Per-user, per-event-type mute toggle — "Absence of a row means
 * enabled by default" per that migration's column comment, so
 * listForUser() returning fewer rows than EVENT_TYPES.length is
 * normal and expected, not a bug — notificationPreferenceService.js
 * (upcoming) is responsible for merging this sparse list with the
 * full EVENT_TYPES set to render a complete preferences UI.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = "id, workspace_id, user_id, event_type, channel, is_enabled, created_at, updated_at";

/**
 * All preference rows a user has explicitly set (any that are absent
 * are implicitly enabled — see module header). channel is not
 * filtered here since 'in_app' is the only value the CHECK constraint
 * currently allows; the column is still selected so a future
 * multi-channel UI doesn't need a repository change, just a filter
 * added by the caller.
 */
async function listForUser(userId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return data || [];
}

async function findOne(userId, workspaceId, eventType, channel = "in_app") {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("event_type", eventType)
    .eq("channel", channel)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Upsert on the (workspace_id, user_id, event_type, channel) unique
 * constraint from migration 019 — a user toggling the same event type
 * twice updates the same row rather than accumulating duplicates.
 */
async function upsert(userId, workspaceId, eventType, isEnabled, channel = "in_app") {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        event_type: eventType,
        channel,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,user_id,event_type,channel" }
    )
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Batch check used by notificationService.js before fanning out a
 * notification to many recipients — one query for "which of these
 * users have muted this event type" instead of N individual lookups.
 * Returns a Set of user_ids that have explicitly disabled eventType.
 */
async function findDisabledUserIds(userIds, workspaceId, eventType, channel = "in_app") {
  if (!userIds || userIds.length === 0) return new Set();

  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id")
    .in("user_id", userIds)
    .eq("workspace_id", workspaceId)
    .eq("event_type", eventType)
    .eq("channel", channel)
    .eq("is_enabled", false);

  if (error) throw error;
  return new Set((data || []).map((row) => row.user_id));
}

module.exports = {
  listForUser,
  findOne,
  upsert,
  findDisabledUserIds,
};
