// Single source of truth for turning a list of rows into an RFC 4180 CSV
// string, so the next admin export doesn't hand-roll its own comma-joining
// and re-discover the quoting rules the hard way.
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

// Characters that Excel/Sheets treat as the start of a formula rather than
// literal text when a cell begins with one of them (CWE-1236, "CSV
// injection"). Every field here can carry attacker-controlled data (a
// buyer's own name, for instance), so this isn't hypothetical.
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

// A field needs quoting the moment it could otherwise be misread as more
// than one field or more than one row — a comma, a quote, or a line break.
// Embedded quotes are escaped by doubling, per RFC 4180.
function escapeCsvField(value: string): string {
  // A leading apostrophe forces Excel/Sheets to render the cell as plain
  // text instead of evaluating it as a formula — the reader still sees the
  // original text (spreadsheet apps hide the leading `'` the same way they
  // do for a manually-typed "text" number), so this is invisible for every
  // legitimate field and only neuters the injection vector.
  const sanitized =
    value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0])
      ? `'${value}`
      : value;

  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvField(column.header));
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvField(String(column.value(row) ?? ''))),
  );

  // CRLF line endings, per RFC 4180 — Excel (the tool this is actually
  // opened in) treats a bare LF export as a hint the file may be malformed.
  return [header, ...lines].map((line) => line.join(',')).join('\r\n');
}

// Two Excel-only compatibility fixes, deliberately kept out of toCsv() so
// that function stays a plain, general-purpose RFC 4180 serializer usable
// by anything, not just a file destined for Excel:
//  - A leading UTF-8 BOM is what makes Excel render accented Spanish text
//    ("Dirección", "Bogotá") correctly instead of as mojibake when opening
//    a saved file — it never reads the HTTP charset header for that.
//  - A literal `sep=,` first line overrides Excel's own list separator,
//    which defaults to `;` (not `,`) under Spanish/Latin American regional
//    settings — this app's es-CO audience — when a .csv is opened by
//    double-clicking rather than imported through the Data menu.
const UTF8_BOM = '\uFEFF';

export function withExcelCompat(body: string): string {
  return `${UTF8_BOM}sep=,\r\n${body}`;
}
