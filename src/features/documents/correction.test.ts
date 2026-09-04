import { describe, expect, it } from 'vitest';
import type { NormalizedRecord } from '@/domain/document';
import { changedFields, correctionFormSchema, formValuesFrom, uncertainFields } from './correction';

function record(overrides: Partial<Record<keyof NormalizedRecord, string | undefined>> = {}) {
  const base: Record<keyof NormalizedRecord, string | undefined> = {
    personName: 'Nasrin Ali',
    phone: '+8801711111111',
    location: 'Sylhet Sadar',
    programName: 'Winter relief',
    documentDate: '2024-03-18',
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      { value, confidence: 0.4, source: 'ocr' as const },
    ]),
  ) as NormalizedRecord;
}

const valid = {
  personName: 'Nasrin Ali',
  phone: '+8801711111111',
  location: 'Sylhet Sadar',
  programName: 'Winter relief',
  documentDate: '2024-03-18',
};

describe('correctionFormSchema', () => {
  it('accepts a complete record', () => {
    expect(correctionFormSchema.safeParse(valid).success).toBe(true);
  });

  it('lets every field be left empty', () => {
    // A page with no phone number on it is a fact about the document. Refusing
    // to save would push an operator into inventing one.
    const blank = { ...valid, phone: '', personName: '', documentDate: '' };
    expect(correctionFormSchema.safeParse(blank).success).toBe(true);
  });

  it('accepts a number from any country, in the one form the archive stores', () => {
    // The rule used to be a character class, which accepted "01711 111111" and
    // "(02) 55 66 77" as different values for numbers that may be the same one.
    // The field composes E.164 from a country and the national digits, so the
    // archive holds one spelling per number.
    for (const phone of ['+8801711111111', '+442071838750', '+14155552671']) {
      expect(correctionFormSchema.safeParse({ ...valid, phone }).success).toBe(true);
    }
  });

  it('rejects a phone number that is not one', () => {
    expect(correctionFormSchema.safeParse({ ...valid, phone: 'call the office' }).success).toBe(
      false,
    );
  });

  it('rejects a number of the right length that no operator prefix matches', () => {
    const parsed = correctionFormSchema.safeParse({ ...valid, phone: '+8801012345678' });

    expect(parsed.success).toBe(false);
    // Naming the country is the difference between a message an operator can
    // act on and one that only says no.
    expect(parsed.error?.issues[0]?.message).toBe('Not a valid Bangladesh number');
  });

  it('rejects a year that is almost certainly a mistyped one', () => {
    expect(correctionFormSchema.safeParse({ ...valid, documentDate: '0024-03-18' }).success).toBe(
      false,
    );
  });

  it('rejects a day that does not exist', () => {
    expect(correctionFormSchema.safeParse({ ...valid, documentDate: '2024-02-31' }).success).toBe(
      false,
    );
  });

  it('rejects a document dated in the future', () => {
    expect(correctionFormSchema.safeParse({ ...valid, documentDate: '2099-01-01' }).success).toBe(
      false,
    );
  });

  it('trims what an operator typed', () => {
    const parsed = correctionFormSchema.parse({ ...valid, personName: '  Nasrin Ali  ' });
    expect(parsed.personName).toBe('Nasrin Ali');
  });
});

describe('formValuesFrom', () => {
  it('reads a missing value as an empty field, not as undefined', () => {
    expect(formValuesFrom(record({ phone: undefined })).phone).toBe('');
  });
});

describe('changedFields', () => {
  it('sends only what the operator actually changed', () => {
    const fields = record();
    const values = { ...formValuesFrom(fields), personName: 'Nasrin Ali Khan' };

    expect(changedFields(fields, values)).toEqual([
      { field: 'personName', value: 'Nasrin Ali Khan' },
    ]);
  });

  it('sends nothing when nothing moved', () => {
    const fields = record();
    expect(changedFields(fields, formValuesFrom(fields))).toEqual([]);
  });

  it('treats filling a missing value as a change', () => {
    const fields = record({ phone: undefined });
    const values = { ...formValuesFrom(fields), phone: '+8801700000000' };

    expect(changedFields(fields, values)).toEqual([{ field: 'phone', value: '+8801700000000' }]);
  });
});

describe('uncertainFields', () => {
  it('records a confirmation as a correction, at the value already there', () => {
    const fields = record();
    const values = formValuesFrom(fields);

    expect(uncertainFields(values, (key) => key === 'location')).toEqual([
      { field: 'location', value: 'Sylhet Sadar' },
    ]);
  });
});
