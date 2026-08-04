/**
 * Approval Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `approvals`. Append-only — one row per decision event (dept_lead
 * approve/reject, finance approve/reject), never updated or deleted.
 * The transaction's own `approval_status` column is the current-state
 * summary; this table is the full decision history behind it.
 *
 * Table: approvals
 * Columns: id, transaction_id, workspace_id, step, decision,
 *          decided_by, notes, created_at
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, transaction_id, workspace_id, step, decision, decided_by, notes, created_at";

async function listByTransaction(transactionId) {
  const { data, error } = await supabaseAdmin
    .from("approvals")
    .select(SELECT_COLUMNS)
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("approvals")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

module.exports = { listByTransaction, create };
