import { describe, expect, it } from 'vitest';
import { CSV_BOM, csvRow, csvValue, toCsv } from './serialize';

describe('csvValue', () => {
  it('leaves an ordinary value alone', () => {
    expect(csvValue('Rahima Khatun')).toBe('Rahima Khatun');
    expect(csvValue(42)).toBe('42');
  });

  it('renders an absent value as an empty field, not as "undefined"', () => {
    expect(csvValue(undefined)).toBe('');
    expect(csvValue(null)).toBe('');
    expect(csvValue('')).toBe('');
  });

  it('quotes a value holding the delimiter', () => {
    expect(csvValue('Dhaka, Bangladesh')).toBe('"Dhaka, Bangladesh"');
  });

  it('quotes and doubles an embedded quote', () => {
    expect(csvValue('the "north" ward')).toBe('"the ""north"" ward"');
  });

  it('quotes a value holding a line break', () => {
    expect(csvValue('line one\nline two')).toBe('"line one\nline two"');
    expect(csvValue('line one\r\nline two')).toBe('"line one\r\nline two"');
  });

  // Unquoted surrounding space is silently trimmed by some readers, which
  // quietly changes an operator-entered value.
  it('quotes a value with surrounding whitespace', () => {
    expect(csvValue(' leading')).toBe('" leading"');
    expect(csvValue('trailing ')).toBe('"trailing "');
  });

  describe('formula injection', () => {
    // These are values a person typed into a correction form. A spreadsheet
    // would otherwise execute them when the export is opened.
    it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\t=cmd', '\r=cmd'])('neutralizes %j', (value) => {
      expect(csvValue(value).replace(/^"|"$/g, '')).toMatch(/^'/);
    });

    it('quotes the escaped value when it also needs quoting', () => {
      expect(csvValue('=1,2')).toBe(`"'=1,2"`);
    });

    it('does not touch a value that merely contains an operator', () => {
      expect(csvValue('Ward 3 + 4')).toBe('Ward 3 + 4');
    });
  });
});

describe('csvRow', () => {
  it('joins fields and terminates the line', () => {
    expect(csvRow(['a', 'b'])).toBe('a,b\r\n');
  });

  it('keeps empty fields positional', () => {
    expect(csvRow(['a', undefined, 'c'])).toBe('a,,c\r\n');
  });

  it('renders a row of nothing but separators', () => {
    expect(csvRow([undefined, undefined])).toBe(',\r\n');
  });
});

describe('toCsv', () => {
  it('leads with the byte order mark and the header', () => {
    const csv = toCsv(['id', 'name'], [['ARC-000001', 'Rahima']]);

    expect(csv).toBe(`${CSV_BOM}id,name\r\nARC-000001,Rahima\r\n`);
  });

  it('writes a header-only file when there are no rows', () => {
    expect(toCsv(['id'], [])).toBe(`${CSV_BOM}id\r\n`);
  });

  it('accepts any iterable, so rows need not be collected first', () => {
    function* rows() {
      yield ['1'];
      yield ['2'];
    }

    expect(toCsv(['n'], rows())).toBe(`${CSV_BOM}n\r\n1\r\n2\r\n`);
  });

  // Round-tripped rather than eyeballed: the escaping rules only matter if a
  // reader can undo them.
  it('produces fields a reader can recover', () => {
    const values = ['plain', 'has, comma', 'has "quote"', 'has\nnewline', '=formula', ''];
    const body = toCsv(
      ['v'],
      values.map((value) => [value]),
    ).slice(CSV_BOM.length);

    expect(parseSingleColumn(body)).toEqual([
      'v',
      'plain',
      'has, comma',
      'has "quote"',
      'has\nnewline',
      "'=formula",
      '',
    ]);
  });
});

/** A deliberately small RFC 4180 reader, for one column only. */
function parseSingleColumn(csv: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];

    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === '\r' && csv[i + 1] === '\n') {
      fields.push(field);
      field = '';
      i += 1;
    } else field += char;
  }

  return fields;
}
