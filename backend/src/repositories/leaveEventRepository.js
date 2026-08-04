/**
 * Leave Event Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `leave_events`. Table: leave_events (PRD §15.16 database design,
 * migration 014) — append-only audit trail, same pattern as
 * `employee_events`.
 *
 * Unlike employee_events (which is populated entirely by DB triggers —
 * see employeeEventRepository.js's header), leave_events has no
 * trigger backing it; leaveRequestService.js writes a row here
 * explicitly at every state change (submitted, dept_approved,
 * approved, rejected, cancelled, edited-while-pending). create() is
 * therefore exposed here, deliberately the only mutating function —
 * rows are never updated or deleted once written.
 *
 * Columns: id, leave_request_id, event_type, metadata, created_by,
 *          created_at
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = "id, leave_request_id, event_type, metadata, created_by, created_at";

async function listByLeaveRequest(leaveRequestId) {
  const { data, error } = await supabaseAdmin
    .from("leave_events")
    .select(SELECT_COLUMNS)
    .eq("leave_request_id", leaveRequestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function create({ leaveRequestId, eventType, metadata = {}, createdBy = null }) {
  const { data, error } = await supabaseAdmin
    .from("leave_events")
    .insert({
      leave_request_id: leaveRequestId,
      event_type: eventType,
      metadata,
      created_by: createdBy,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

module.exports = { listByLeaveRequest, create };