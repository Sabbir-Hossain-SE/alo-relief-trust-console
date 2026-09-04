import { z } from 'zod';
import { NORMALIZED_FIELD_KEYS } from '@/domain/document';
import { documentDateMessage } from '@/lib/date/isoDate';
import { phoneProblem } from '@/lib/phone/phone';

/**
 * A correction has to satisfy the same rules the form applies.
 *
 * The form is where an operator meets them, but a backend that accepts whatever
 * reaches it is not validating — it is trusting the client, and the archive
 * ends up holding numbers no network routes and days that never happened. Both
 * ends read the rule from `lib/`, so they cannot disagree.
 *
 * Kept apart from the rest of the contract because the phone rule brings every
 * numbering plan with it, and only the handlers and the correction form — both
 * loaded on demand — have any use for that.
 */
const FIELD_RULES: Partial<
  Record<(typeof NORMALIZED_FIELD_KEYS)[number], (value: string) => string | null>
> = {
  phone: phoneProblem,
  documentDate: (value) => documentDateMessage(value),
};

export const correctionSchema = z
  .object({
    field: z.enum(NORMALIZED_FIELD_KEYS),
    value: z.string().trim().max(200),
  })
  .superRefine(({ field, value }, ctx) => {
    const problem = FIELD_RULES[field]?.(value) ?? null;
    if (problem !== null) ctx.addIssue({ code: 'custom', path: ['value'], message: problem });
  });

export type CorrectionInput = z.infer<typeof correctionSchema>;

/**
 * A whole pass over a record, not one field at a time.
 *
 * An operator working through a review task usually fixes several fields at
 * once. Sending them separately would mean a request and a refetch per field,
 * and an audit trail that reads as several visits rather than one.
 */
export const correctionsSchema = z.object({
  corrections: z.array(correctionSchema).min(1).max(NORMALIZED_FIELD_KEYS.length),
});

export type CorrectionsInput = z.infer<typeof correctionsSchema>;
