/**
 * Password Reset Repository
 * ------------------------------------------------------------------
 * Thin data-access layer for the `password_reset_tokens` table
 * (migration 022). Only SHA-256 hashes of tokens are ever stored;
 * the raw token lives only in the emailed link.
 */

const { supabaseAdmin } = require("../config/supabase");

async function create({ user_id, email, token_hash, expires_at }) {
  const { data, error } = await supabaseAdmin
    .from("password_reset_tokens")
    .insert({ user_id, email, token_hash, expires_at })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function findByTokenHash(tokenHash) {
  const { data, error } = await supabaseAdmin
    .from("password_reset_tokens")
    .select("id, user_id, email, expires_at, used_at, created_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markUsed(id) {
  const { data, error } = await supabaseAdmin
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Burn every outstanding (unused) reset token for a user before issuing
 * a new one, so only the latest emailed link can ever succeed.
 */
async function invalidateOutstandingForUser(userId) {
  const { error } = await supabaseAdmin
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);
  if (error) throw error;
}

module.exports = {
  create,
  findByTokenHash,
  markUsed,
  invalidateOutstandingForUser,
};
