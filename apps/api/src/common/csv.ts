// Single source of truth for turning a list of rows into an RFC 4180 CSV
// string, so the next admin export doesn't hand-roll its own comma-joining
// and re-discover the quoting rules the hard way.
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

// A field needs quoting the moment it could otherwise be misread as more
// than one field or more than one row — a comma, a quote, or a line break.
// Embedded quotes are escaped by doubling, per RFC 4180.
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
