/**
 * Local-safe date formatting helpers.
 * ------------------------------------------------------------------
 * Leave dates (start_date/end_date) are stored and sent as plain
 * "YYYY-MM-DD" strings with no time/timezone component. When building
 * a calendar-day iteration in the browser, the natural approach is:
 *
 *   const d = new Date(`${dateStr}T00:00:00`);   // local midnight
 *   ... d.setDate(d.getDate() + 1) ...
 *   const key = d.toISOString().split('T')[0];   // BUG
 *
 * `toISOString()` always converts to UTC first. For any timezone
 * ahead of UTC (e.g. IST, UTC+5:30) local midnight is the *previous*
 * day in UTC, so the resulting string is one day earlier than the
 * calendar date the user actually selected/sees. Leave requests would
 * then render as starting/ending a day earlier on the calendar than
 * their actual start_date/end_date in the database — exactly the kind
 * of off-by-one that makes an approved leave "not show up" on the day
 * it was actually approved for.
 *
 * toLocalDateStr formats a Date using its LOCAL calendar fields
 * instead, so a date built from local midnight round-trips back to
 * the same "YYYY-MM-DD" string regardless of the browser's timezone
 * offset.
 */
export function toLocalDateStr(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a "YYYY-MM-DD" string as a local-midnight Date (never as UTC
 * midnight, which is what `new Date('YYYY-MM-DD')` does natively and
 * which shifts the displayed calendar day for any non-UTC timezone).
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}
