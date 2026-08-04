/**
 * Minimal CSV Writer
 * ------------------------------------------------------------------
 * Companion to csvParser.js (which only reads CSV, for bulk import).
 * This is the write-side, added for Sprint 11's mandatory CSV export
 * on every report. Same rationale as csvParser.js's header comment:
 * no CSV library (papaparse, csv-stringify, fast-csv) is installed in
 * this backend's package.json, so this is a small hand-rolled writer
 * covering the common case only:
 *   - comma-delimited, one record per line, CRLF line endings (RFC 4180)
 *   - a header row derived from column config (label, not raw key)
 *   - a field is quoted only when it contains a comma, quote, or
 *     newline; embedded quotes are escaped by doubling ("" per RFC 4180)
 *   - values are stringified via String(); callers are responsible for
 *     formatting (e.g. currency, dates) before passing rows in, since
 *     this utility has no knowledge of column semantics
 *
 * For anything beyond simple tabular exports, add a real library and
 * swap this out rather than extending the quoting logic further here
 * — same guidance csvParser.js gives for the read side.
 */

function escapeCsvField(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const needsQuoting = /[",\n\r]/.test(str);
  if (!needsQuoting) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from row objects and column definitions.
 *
 * @param {Array<Object>} rows - data rows, each a plain object keyed by column.key
 * @param {Array<{key: string, label: string}>} columns - export column order + headers
 * @returns {string} CSV text (CRLF line endings, trailing newline)
 */
function writeCsv(rows, columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("writeCsv requires a non-empty columns array");
  }

  const headerLine = columns.map((col) => escapeCsvField(col.label ?? col.key)).join(",");

  const dataLines = (rows || []).map((row) =>
    columns.map((col) => escapeCsvField(row ? row[col.key] : "")).join(",")
  );

  return [headerLine, ...dataLines].join("\r\n") + "\r\n";
}

module.exports = { writeCsv, escapeCsvField };
