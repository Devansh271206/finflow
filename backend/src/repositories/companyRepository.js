/**
 * Company Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for `companies`.
 * Isolates services from Supabase-specific query syntax (PRD §10.1).
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, name, slug, logo, industry, currency, timezone, country, owner_user_id, created_at, updated_at";

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findBySlug(slug) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByOwner(ownerUserId) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select(SELECT_COLUMNS)
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { findById, findBySlug, findByOwner, create, update, SELECT_COLUMNS };
