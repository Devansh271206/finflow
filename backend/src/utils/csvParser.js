/**
 * Minimal CSV Parser
 * ------------------------------------------------------------------
 * IMPORTANT LIMITATION, stated plainly rather than overclaimed: no CSV
 * parsing library (papaparse, csv-parse, fast-csv) is installed in
 * this backend's package.json, and the environment this was authored
 * in has no network access to run `npm install` and add one. This is a
 * hand-rolled parser covering the common case only:
 *   - comma-delimited, one record per line
 *   - a header row
 *   - quoted fields with "" as an escaped quote inside them
 *   - does NOT handle a quoted field containing a literal newline
 *     (a field value that itself spans multiple lines will break this
 *     parser)
 *
 * For anything beyond simple spreadsheet-exported payroll CSVs, add a
 * real library (`npm install papaparse` — already used on the frontend
 * for the same reason) and swap this out; do not extend this file's
 * quoting logic further as a substitute for that.
 */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  // Normalize line endings so \r\n and \n behave the same.
  const normalized = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++; // skip the escaped quote's second character
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Flush the final field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== "")).map((r) => {
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = (r[idx] ?? "").trim();
    });
    return record;
  });
}

module.exports = { parseCsv };
