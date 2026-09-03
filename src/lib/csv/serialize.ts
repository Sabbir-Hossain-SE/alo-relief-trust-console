/** RFC 4180 line ending. Excel and Numbers both mis-split on a bare newline. */
const LINE_END = '\r\n';

/**
 * Byte order mark.
 *
 * Excel on Windows reads a CSV as the system code page unless the file opens
 * with this, which turns every Bengali name and every accented location in this
 * archive into mojibake. Three bytes to keep the export readable.
 */
export const CSV_BOM = '﻿';

/** Characters a spreadsheet reads as the start of a formula rather than text. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

const NEEDS_QUOTING = /[",\r\n]|^\s|\s$/;

/**
 * Renders one value as a CSV field.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with an apostrophe: spreadsheets
 * evaluate those as formulas, and an archive holds operator-entered text. The
 * apostrophe is the conventional escape and is not shown as part of the value.
 */
export function csvValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';

  const text = typeof value === 'number' ? String(value) : value;
  if (text === '') return '';

  const guarded = FORMULA_LEAD.test(text) ? `'${text}` : text;

  return NEEDS_QUOTING.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** Renders one row, including its line ending, so rows can be concatenated. */
export function csvRow(values: readonly (string | number | undefined | null)[]): string {
  return values.map(csvValue).join(',') + LINE_END;
}

/**
 * Renders a whole table.
 *
 * Built by joining rows rather than by mapping to an array of lines, so the
 * caller can stream instead if the table is large enough to matter.
 */
export function toCsv(
  header: readonly string[],
  rows: Iterable<readonly (string | number | undefined | null)[]>,
): string {
  let out = CSV_BOM + csvRow(header);
  for (const row of rows) out += csvRow(row);

  return out;
}
