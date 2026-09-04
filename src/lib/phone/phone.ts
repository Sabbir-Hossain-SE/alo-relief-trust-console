import {
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';
import EXAMPLES from 'libphonenumber-js/examples.mobile.json';
import { DEFAULT_PHONE_COUNTRY, countryForCallingCode, phoneCountry } from './countries';

/**
 * `max` metadata rather than the default `min`.
 *
 * `min` validates by length alone, so it accepts +880 10 1234 5678 — the right
 * number of digits behind an operator prefix Bangladesh does not issue. This
 * field exists so an operator can repair a number the pipeline misread, and a
 * validator that waves through a plausible-looking wrong number is worse than
 * none: it tells them the repair worked. The cost is metadata for every
 * numbering plan, which is the larger half of this feature's bundle.
 */

/** The two halves a form edits, from the single string the archive stores. */
export type PhoneParts = {
  country: CountryCode;
  /** National digits, without the country's calling code or a trunk prefix. */
  national: string;
};

// Strips everything a person might type as punctuation or spacing.
export function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

// Digits with the country's calling code taken off, when the value carries one.
function withoutCallingCode(value: string, country: CountryCode): string {
  const digits = digitsOf(value);
  const callingCode = getCountryCallingCode(country);

  return value.startsWith('+') && digits.startsWith(callingCode)
    ? digits.slice(callingCode.length)
    : digits;
}

/**
 * Splits a stored number into the country and the national digits.
 *
 * The calling code has to come off even when the number is one the parser
 * cannot place, and a half-typed number is unplaceable by definition. Leaving
 * it on returns digits that get the code prefixed again when the halves are
 * rejoined, so the number grows by a country code on every keystroke.
 *
 * An unparseable value keeps the rest of its digits rather than being
 * discarded, because the operator opening the record needs to see what the
 * pipeline read before they can judge what it should have been.
 */
export function splitPhone(
  value: string,
  fallback: CountryCode = DEFAULT_PHONE_COUNTRY,
): PhoneParts {
  const trimmed = value.trim();
  if (trimmed === '') return { country: fallback, national: '' };

  // A number can be split without being placed: the calling code says where it
  // was dialled from, while naming the country needs a national number that
  // matches one of that country's own patterns.
  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed !== undefined) {
    return { country: parsed.country ?? fallback, national: parsed.nationalNumber };
  }

  return { country: fallback, national: withoutCallingCode(trimmed, fallback) };
}

/**
 * Joins the two halves back into the E.164 string the archive stores.
 *
 * Numbers are written locally with a trunk prefix — 01712 345678 on every form
 * filed in Bangladesh — and E.164 leaves that prefix out. Pasting the digits
 * behind the calling code as they were typed stored +88001712345678, a number
 * the validator happened to tolerate and no gateway would dial. The parser
 * knows each plan's prefix; the plain join remains for input too short to parse.
 */
export function joinPhone(country: CountryCode, national: string): string {
  const digits = digitsOf(national);
  if (digits === '') return '';

  const parsed = parsePhoneNumberFromString(digits, country);
  if (parsed !== undefined && parsed.countryCallingCode === getCountryCallingCode(country)) {
    return parsed.number;
  }

  return `+${getCountryCallingCode(country)}${digits}`;
}

/**
 * Reads a number that arrived carrying its own calling code.
 *
 * An operator copying a number from a spreadsheet pastes "+44 20 7946 0958"
 * into the digits box with Bangladesh still selected. Treated as national
 * digits that becomes +880442079460958 — the calling code doubled and the
 * country wrong. Returns null for anything without a code in front of it, so
 * ordinary typing is untouched.
 */
export function internationalPhone(input: string, current: CountryCode): PhoneParts | null {
  const trimmed = input.trim();
  // 00 is the international prefix in Bangladesh and most of the world; a
  // national number never starts with two zeros.
  const withPlus = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;
  if (!withPlus.startsWith('+')) return null;

  const parsed = parsePhoneNumberFromString(withPlus);
  if (parsed === undefined) return null;

  const country =
    parsed.country ??
    (parsed.countryCallingCode === getCountryCallingCode(current)
      ? current
      : countryForCallingCode(parsed.countryCallingCode));
  if (country === undefined) return null;

  return { country, national: parsed.nationalNumber };
}

/**
 * Whether a stored number is one its country's numbering plan actually allows.
 *
 * Empty passes: a page with no phone number on it is a fact about the document,
 * and a form that refused to save without one would push an operator into
 * inventing data.
 */
export function isStorablePhone(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || isValidPhoneNumber(trimmed);
}

/**
 * Says which country the number failed for, since "invalid" alone leaves an
 * operator with no idea whether the digits or the country is wrong.
 */
export function phoneProblem(value: string): string | null {
  if (isStorablePhone(value)) return null;

  const country = parsePhoneNumberFromString(value.trim())?.country;
  return country === undefined
    ? 'Not a number any country issues'
    : `Not a valid ${phoneCountry(country).name} number`;
}

/**
 * A real number from the country, shown as the field's placeholder.
 *
 * Numbering plans differ enough that "phone number" is not a useful hint: an
 * operator copying from a scan needs to know whether this country expects ten
 * digits or nine before they can tell a misread from a short one.
 *
 * Plain digits, because that is what the field holds. There is no as-you-type
 * grouping on the input and this must not imply one: `AsYouType` decides
 * between national and international formatting from the digits it has been
 * given so far, so a partial number comes back carrying its calling code —
 * "44 1711 111111" for ten national digits. Feeding that display text back in
 * as the value appended the country code again on every keystroke.
 */
export function nationalPlaceholder(country: CountryCode): string {
  return getExampleNumber(country, EXAMPLES)?.nationalNumber ?? '';
}
