import { z } from 'zod';
import { NORMALIZED_FIELD_KEYS, type NormalizedRecord } from '@/domain/document';
import { documentDateProblem, DATE_PROBLEM_MESSAGES } from '@/lib/date/isoDate';
import { phoneProblem } from '@/lib/phone/phone';
import type { CorrectionInput } from '@/server/api-contract';

/**
 * What an operator is allowed to type.
 *
 * Every field may be left empty. A page that genuinely has no phone number on
 * it is a fact about the document, and a form that refuses to save without one
 * would push an operator into inventing data — the opposite of what a review
 * queue is for.
 *
 * The phone and date rules live in `lib/` rather than here because the fields
 * that edit them enforce the same rules while they are being typed, and the
 * mock backend rejects a value that breaks them. Three copies of a rule is
 * three places for it to drift.
 */
export const correctionFormSchema = z.object({
  personName: z.string().trim().max(200),
  phone: z
    .string()
    .trim()
    .max(200)
    .superRefine((value, ctx) => {
      const problem = phoneProblem(value);
      if (problem !== null) ctx.addIssue({ code: 'custom', message: problem });
    }),
  location: z.string().trim().max(200),
  programName: z.string().trim().max(200),
  documentDate: z
    .string()
    .trim()
    .max(200)
    .superRefine((value, ctx) => {
      const problem = documentDateProblem(value);
      if (problem !== null) {
        ctx.addIssue({ code: 'custom', message: DATE_PROBLEM_MESSAGES[problem] });
      }
    }),
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
