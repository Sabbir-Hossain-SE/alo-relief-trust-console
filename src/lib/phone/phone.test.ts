import { describe, expect, it } from 'vitest';
import {
  digitsOf,
  internationalPhone,
  isPendingInternational,
  isStorablePhone,
  joinPhone,
  nationalPlaceholder,
  phoneProblem,
  splitPhone,
} from './phone';
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  countryForCallingCode,
  phoneCountry,
} from './countries';

describe('splitPhone', () => {
  it('reads the country and the national digits out of a stored number', () => {
    expect(splitPhone('+8801712345678')).toEqual({ country: 'BD', national: '1712345678' });
    expect(splitPhone('+14155552671')).toEqual({ country: 'US', national: '4155552671' });
  });

  it('falls back to the archive s own country when there is nothing to read', () => {
    expect(splitPhone('')).toEqual({ country: DEFAULT_PHONE_COUNTRY, national: '' });
    expect(splitPhone('   ')).toEqual({ country: DEFAULT_PHONE_COUNTRY, national: '' });
  });

  it('keeps the digits of a number it cannot place', () => {
    // The operator has to see what the pipeline read before they can judge it.
    expect(splitPhone('0171 234')).toEqual({ country: DEFAULT_PHONE_COUNTRY, national: '0171234' });
  });

  it('honours the caller s fallback, so a half-typed number keeps its country', () => {
    expect(splitPhone('+1', 'CA').country).toBe('CA');
    expect(splitPhone('', 'GB')).toEqual({ country: 'GB', national: '' });
  });

  it('takes the calling code off a number it can split but cannot place', () => {
    // +44 with ten digits behind it is not a number the UK issues, so the
    // parser reports a calling code and no country. Keeping the 44 in the
    // national half is what made a rejoin append the country code a second
    // time, growing the number by one code per keystroke.
    expect(splitPhone('+441711111111', 'GB')).toEqual({ country: 'GB', national: '1711111111' });
  });

  it('takes the calling code off a number it cannot parse at all', () => {
    expect(splitPhone('+9991234', 'GB').national).toBe('9991234');
    expect(splitPhone('+44207', 'GB').national).toBe('207');
  });

  it('survives being rejoined and split again while a number is typed', () => {
    // The property the field depends on: growing the number a digit at a time
    // must not grow it by anything else.
    let stored = '';
    for (const digit of '2071838750') {
      const parts = splitPhone(stored, 'GB');
      stored = joinPhone(parts.country, parts.national + digit);
    }

    expect(stored).toBe('+442071838750');
  });
});

describe('joinPhone', () => {
  it('builds the E.164 string the archive stores', () => {
    expect(joinPhone('BD', '1712345678')).toBe('+8801712345678');
    expect(joinPhone('GB', '20 7183 8750')).toBe('+442071838750');
  });

  it('reduces an empty number to empty rather than to a bare calling code', () => {
    expect(joinPhone('BD', '')).toBe('');
    expect(joinPhone('BD', '   ')).toBe('');
  });

  it('round-trips with splitPhone', () => {
    const parts = splitPhone('+8801712345678');
    expect(joinPhone(parts.country, parts.national)).toBe('+8801712345678');
  });

  /**
   * Every number on a form filed in Bangladesh is written 01712-345678, and an
   * operator copies it as written. E.164 has no trunk prefix, so the join has
   * to know to take the 0 off — the naive one stored +88001712345678, which the
   * validator happened to tolerate and no gateway would dial.
   */
  it('drops the trunk prefix a number is written with locally', () => {
    expect(joinPhone('BD', '01712345678')).toBe('+8801712345678');
    expect(joinPhone('BD', '01712-345678')).toBe('+8801712345678');
    expect(joinPhone('GB', '020 7183 8750')).toBe('+442071838750');
  });

  it('still joins digits too short to be understood as a number', () => {
    expect(joinPhone('BD', '1')).toBe('+8801');
    expect(joinPhone('BD', '0171')).toBe('+8800171');
  });

  it('survives being rejoined and split while a local number is typed with its prefix', () => {
    let stored = '';
    for (const digit of '01712345678') {
      const parts = splitPhone(stored, 'BD');
      stored = joinPhone(parts.country, parts.national + digit);
    }

    expect(stored).toBe('+8801712345678');
  });
});

describe('internationalPhone', () => {
  it('reads the country out of a number pasted with its calling code', () => {
    expect(internationalPhone('+44 20 7946 0958', 'BD')).toEqual({
      country: 'GB',
      national: '2079460958',
    });
    expect(internationalPhone('+880 1712-345678', 'GB')).toEqual({
      country: 'BD',
      national: '1712345678',
    });
  });

  it('reads a number pasted in Bengali numerals', () => {
    expect(internationalPhone('+৪৪ ২০ ৭৯৪৬ ০৯৫৮', 'BD')).toEqual({
      country: 'GB',
      national: '2079460958',
    });
  });

  it('accepts the 00 an operator dials instead of a plus', () => {
    expect(internationalPhone('0044 20 7946 0958', 'BD')).toEqual({
      country: 'GB',
      national: '2079460958',
    });
  });

  it('leaves national digits alone, including ones that begin with one zero', () => {
    expect(internationalPhone('1712345678', 'BD')).toBeNull();
    expect(internationalPhone('01712345678', 'BD')).toBeNull();
    expect(internationalPhone('', 'BD')).toBeNull();
  });

  it('is null for a plus with nothing readable behind it', () => {
    expect(internationalPhone('+', 'BD')).toBeNull();
    expect(internationalPhone('+9', 'BD')).toBeNull();
  });

  it('keeps the selected country when the code matches but the number cannot be placed', () => {
    // Ten digits behind +44 is not a number the UK issues, so the parser
    // reports the code and no country. The selection already says which.
    expect(internationalPhone('+441711111111', 'GB')).toEqual({
      country: 'GB',
      national: '1711111111',
    });
  });

  it('picks a country for a code the selection does not match', () => {
    expect(internationalPhone('+441711111111', 'BD')?.country).toBe('GB');
  });
});

describe('isStorablePhone', () => {
  it('accepts a number its country actually issues', () => {
    expect(isStorablePhone('+8801712345678')).toBe(true);
    expect(isStorablePhone('+14155552671')).toBe(true);
  });

  it('accepts empty, because a page with no number on it is a fact', () => {
    expect(isStorablePhone('')).toBe(true);
    expect(isStorablePhone('  ')).toBe(true);
  });

  it('rejects a number of the right length behind an operator prefix nobody issues', () => {
    // The reason this uses full metadata: length alone passes this number.
    expect(isStorablePhone('+8801012345678')).toBe(false);
  });

  it('rejects a number that is simply too short', () => {
    expect(isStorablePhone('+880171234')).toBe(false);
    expect(isStorablePhone('not a phone number')).toBe(false);
  });
});

describe('phoneProblem', () => {
  it('says nothing about a number that is fine', () => {
    expect(phoneProblem('+8801712345678')).toBeNull();
    expect(phoneProblem('')).toBeNull();
  });

  it('names the country, so the operator knows which half is wrong', () => {
    expect(phoneProblem('+8801012345678')).toBe('Not a valid Bangladesh number');
  });

  it('says so plainly when no country claims the number', () => {
    expect(phoneProblem('+99912345')).toBe('Not a number any country issues');
  });
});

describe('nationalPlaceholder', () => {
  it('shows a real number from the country, so the expected length is visible', () => {
    expect(nationalPlaceholder('BD')).toBe('1812345678');
    expect(nationalPlaceholder('US')).toBe('2015550123');
  });

  it('is digits only, because that is what the field holds', () => {
    // Not a formatted example. The field does no as-you-type grouping, and a
    // placeholder that showed some would promise an input shape that the field
    // rejects the moment it is typed.
    for (const country of ['BD', 'US', 'GB', 'IN'] as const) {
      expect(nationalPlaceholder(country)).toMatch(/^\d+$/);
    }
  });
});

describe('digitsOf', () => {
  it('strips everything a person types as spacing', () => {
    expect(digitsOf('+880 (17) 12-345678')).toBe('8801712345678');
    expect(digitsOf('')).toBe('');
  });

  // Many of the forms in this archive are filled in with Bengali numerals, and
  // `\d` matches ASCII alone, so a number pasted from one emptied the field.
  it('reads digits written in Bengali, Devanagari and Arabic-Indic numerals', () => {
    expect(digitsOf('০১৭১২-৩৪৫৬৭৮')).toBe('01712345678');
    expect(digitsOf('०१७१२३४५६७८')).toBe('01712345678');
    expect(digitsOf('٠١٧١٢٣٤٥٦٧٨')).toBe('01712345678');
    expect(digitsOf('۰۱۷۱۲۳۴۵۶۷۸')).toBe('01712345678');
  });
});

describe('isPendingInternational', () => {
  it('is true for a plus, or a 00, with too little behind it to read', () => {
    for (const typed of ['+', '+4', '+44', '+442', '00', '004', '0044']) {
      expect(isPendingInternational(typed)).toBe(true);
    }
  });

  it('is false once the calling code and a start on the number can be read', () => {
    expect(isPendingInternational('+4420')).toBe(false);
    expect(isPendingInternational('+442079460958')).toBe(false);
    expect(isPendingInternational('0044 20 7946 0958')).toBe(false);
  });

  it('is false for national digits, which are never pending', () => {
    expect(isPendingInternational('')).toBe(false);
    expect(isPendingInternational('0')).toBe(false);
    expect(isPendingInternational('01712345678')).toBe(false);
  });
});

describe('the country list', () => {
  it('is sorted by name, which is how a person looks one up', () => {
    const names = PHONE_COUNTRIES.map((country) => country.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('names countries rather than listing their codes', () => {
    expect(phoneCountry('BD')).toEqual({ code: 'BD', name: 'Bangladesh', callingCode: '880' });
  });

  it('falls back to the archive s own country for a code it does not know', () => {
    expect(phoneCountry('ZZ' as never).code).toBe(DEFAULT_PHONE_COUNTRY);
  });

  it('finds a country by the code it dials with', () => {
    expect(countryForCallingCode('880')).toBe('BD');
    expect(countryForCallingCode('999')).toBeUndefined();
  });
});
