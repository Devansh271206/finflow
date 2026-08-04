/**
 * Attachment Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `attachments` (transaction-level, plural — distinct from the
 * existing single transactions.receipt_url column). storage_path (not
 * a URL) is stored; signed, time-limited URLs are generated on read
 * via utils/upload.js:getSignedDocumentUrl() — same pattern
 * employeeDocumentRepository.js established in Sprint 2.
 *
 * Table: attachments
 * Columns: id, transaction_id, file_name, mime_type, storage_path,
 *          uploaded_by, created_at
 *
 * No update() exposed — a file is replaced by uploading a new one and
 * deleting the old, same convention as employee_documents.
 * transactions.attachment_count is maintained entirely by a DB trigger
 * (migration 009) — this repository never touches that column.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, transaction_id, file_name, mime_type, storage_path, uploaded_by, created_at";

async function listByTransaction(transactionId) {
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select(SELECT_COLUMNS)
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function findByIdForTransaction(id, transactionId) {
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("transaction_id", transactionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function deleteForTransaction(id, transactionId) {
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .delete()
    .eq("id", id)
    .eq("transaction_id", transactionId)
    .select("id, storage_path")
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { listByTransaction, findByIdForTransaction, create, deleteForTransaction };
