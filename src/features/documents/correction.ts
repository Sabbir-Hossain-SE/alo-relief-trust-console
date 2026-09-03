import { z } from 'zod';
import { NORMALIZED_FIELD_KEYS, type NormalizedRecord } from '@/domain/document';
import type { CorrectionInput } from '@/server/api-contract';

/** Loose on purpose: an archive holds numbers written in a dozen local styles. */
const PHONE = /^\+?[\d\s()-]{6,24}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Reports whether a date string names a day that actually exists.
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * What an operator is allowed to type.
 *
 * Every field may be left empty. A page that genuinely has no phone number on
 * it is a fact about the document, and a form that refuses to save without one
 * would push an operator into inventing data — the opposite of what a review
 * queue is for.
 */
export const correctionFormSchema = z.object({
  personName: z.string().trim().max(200),
  phone: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === '' || PHONE.test(value), 'Use digits, spaces and + ( ) - only'),
  location: z.string().trim().max(200),
  programName: z.string().trim().max(200),
  documentDate: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === '' || ISO_DATE.test(value), 'Use the form 2024-03-18')
    .refine((value) => value === '' || isRealDate(value), 'That day does not exist')
    .refine(
      (value) => value === '' || new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
      'A document cannot be dated in the future',
    ),
});

export type CorrectionFormValues = z.infer<typeof correctionFormSchema>;

// Reads the current values into the shape the form edits.
export function formValuesFrom(fields: NormalizedRecord): CorrectionFormValues {
  return Object.fromEntries(
    NORMALIZED_FIELD_KEYS.map((key) => [key, fields[key].value ?? '']),
  ) as CorrectionFormValues;
}

/**
 * Narrows a submission to what actually changed.
 *
 * Sending every field would rewrite untouched values as operator-entered and
 * fill the audit trail with corrections nobody made.
 */
export function changedFields(
  fields: NormalizedRecord,
  values: CorrectionFormValues,
): CorrectionInput[] {
  return NORMALIZED_FIELD_KEYS.filter((key) => values[key] !== (fields[key].value ?? '')).map(
    (key) => ({ field: key, value: values[key] }),
  );
}

/**
 * The fields an operator still has to answer, at their current values.
 *
 * Used to confirm a record the pipeline was merely unsure about: the values
 * were right, and saying so is a correction like any other, so it is recorded
 * as one rather than silently clearing the flag.
 */
export function uncertainFields(
  values: CorrectionFormValues,
  needsReview: (key: keyof NormalizedRecord) => boolean,
): CorrectionInput[] {
  return NORMALIZED_FIELD_KEYS.filter(needsReview).map((key) => ({
    field: key,
    value: values[key],
  }));
}
