import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/max';
import metadata from 'libphonenumber-js/metadata.max.json';

export type PhoneCountry = {
  code: CountryCode;
  /** The country's English name, for the menu and the accessible name. */
  name: string;
  /** Digits only, without the leading plus. */
  callingCode: string;
};

/**
 * The archive's own country.
 *
 * Every record in it was filed in Bangladesh, so the common case is a number
 * typed without a country ever being chosen. Defaulting elsewhere would make
 * the selector a step on the way to every phone correction.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'BD';

function regionNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    // Safari before 14.1 has no DisplayNames. A menu of codes beats a form
    // that fails to load because its country list threw at import time.
    return null;
  }
}

const REGION_NAMES = regionNames();

function nameOf(code: CountryCode): string {
  return REGION_NAMES?.of(code) ?? code;
}

// Every country the validator has a numbering plan for, in alphabetical order.
export const PHONE_COUNTRIES: readonly PhoneCountry[] = getCountries()
  .map((code) => ({ code, name: nameOf(code), callingCode: getCountryCallingCode(code) }))
  .sort((first, second) => first.name.localeCompare(second.name, 'en'));

const BY_CODE = new Map(PHONE_COUNTRIES.map((country) => [country.code, country]));

// Looks up one country, or the default when the code is not one we know.
export function phoneCountry(code: CountryCode): PhoneCountry {
  return BY_CODE.get(code) ?? (BY_CODE.get(DEFAULT_PHONE_COUNTRY) as PhoneCountry);
}

/**
 * The country a calling code belongs to first of all: the United Kingdom for
 * 44, not Guernsey; the United States for 1, not Antigua. The numbering plan
 * lists them in that order, and picking by name would not.
 */
export function countryForCallingCode(callingCode: string): CountryCode | undefined {
  return metadata.country_calling_codes[callingCode]?.[0];
}
