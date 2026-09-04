/**
 * The earliest day a document may be dated.
 *
 * A four-digit year field accepts 0023 as readily as 2023, and a mistyped year
 * is the commonest way a date goes wrong. The floor is the picker's own default
 * and is stated here so the field and the schema cannot drift apart.
 */
export const EARLIEST_DOCUMENT_DATE = '1900-01-01';

export type DateProblem = 'malformed' | 'impossible' | 'too-early' | 'future';

export const DATE_PROBLEM_MESSAGES: Record<DateProblem, string> = {
  malformed: 'Use the form 2024-03-18',
  impossible: 'That day does not exist',
  'too-early': `Nothing in the archive predates ${EARLIEST_DOCUMENT_DATE}`,
  future: 'A document cannot be dated in the future',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Reads an ISO day as an epoch, at midnight UTC so no timezone shifts the day.
export function epochOfIsoDate(value: string): number {
  return new Date(`${value}T00:00:00Z`).getTime();
}

// Reports whether an ISO string names a day that actually exists.
export function isRealDate(value: string): boolean {
  const epoch = epochOfIsoDate(value);
  return !Number.isNaN(epoch) && new Date(epoch).toISOString().slice(0, 10) === value;
}

/**
 * Today as YYYY-MM-DD, by the operator's own clock.
 *
 * Local rather than UTC on purpose. The archive is worked from Dhaka, six hours
 * ahead of UTC, where "today" is a date UTC has not reached until six in the
 * morning — so measured against UTC, a document dated the day it was filed was
 * refused as being from the future for the first quarter of every working day.
 */
export function localIsoDate(now: number = Date.now()): string {
  const date = new Date(now);
  const pad = (part: number) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * What is wrong with a document date, or null when nothing is.
 *
 * Empty is not a problem: a scan with no legible date on it is a fact about the
 * document, and a form that refused to save without one would push an operator
 * into inventing data.
 */
export function documentDateProblem(value: string, now: number = Date.now()): DateProblem | null {
  if (value === '') return null;
  if (!ISO_DATE.test(value)) return 'malformed';
  if (!isRealDate(value)) return 'impossible';
  if (epochOfIsoDate(value) < epochOfIsoDate(EARLIEST_DOCUMENT_DATE)) return 'too-early';
  // Zero-padded ISO days compare as strings, which sidesteps the timezone entirely.
  if (value > localIsoDate(now)) return 'future';

  return null;
}

// The message an operator reads for a date the form will not accept.
export function documentDateMessage(value: string, now?: number): string | null {
  const problem = documentDateProblem(value, now);
  return problem === null ? null : DATE_PROBLEM_MESSAGES[problem];
}
