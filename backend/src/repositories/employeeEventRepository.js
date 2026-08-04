/**
 * Employee Event Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `employee_events`. Read-only on purpose — this table is populated
 * entirely by the employees_timeline_trigger() and
 * salary_history_timeline_trigger() DB triggers (migration 007), never
 * by application code. There is deliberately no create()/insert()
 * function here to make that boundary hard to violate accidentally.
 *
 * Table: employee_events
 * Columns: id, employee_id, event_type, description, metadata,
 *          created_at
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = "id, employee_id, event_type, description, metadata, created_at";

async function listByEmployee(employeeId) {
  const { data, error } = await supabaseAdmin
    .from("employee_events")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

module.exports = { listByEmployee };
