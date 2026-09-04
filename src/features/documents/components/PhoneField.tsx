'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import type { CountryCode } from 'libphonenumber-js/max';
import { PHONE_COUNTRIES, phoneCountry } from '@/lib/phone/countries';
import {
  internationalPhone,
  isPendingInternational,
  joinPhone,
  nationalPlaceholder,
  splitPhone,
} from '@/lib/phone/phone';

type PhoneFieldProps = {
  label: string;
  labelId: string;
  /** The stored number, in E.164, or empty when the page had none. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

function countryCodeLabel(code: CountryCode): string {
  return `${code} +${phoneCountry(code).callingCode}`;
}

/**
 * The menu's two hundred and forty-five items, built once.
 *
 * MUI's select clones every child it is given on every render, open or not,
 * so a list rebuilt per keystroke cost the field a few hundred elements and
 * closures each time a digit was typed.
 */
const COUNTRY_OPTIONS = PHONE_COUNTRIES.map((option) => (
  <MenuItem key={option.code} value={option.code}>
    {option.name} +{option.callingCode}
  </MenuItem>
));

// An example number per country, parsed once rather than on every render.
const placeholders = new Map<CountryCode, string>();

function placeholderFor(country: CountryCode): string {
  let placeholder = placeholders.get(country);
  if (placeholder === undefined) {
    placeholder = nationalPlaceholder(country);
    placeholders.set(country, placeholder);
  }
  return placeholder;
}

/**
 * A phone number as its two real parts: which country issues it, and the
 * national digits.
 *
 * The archive stores one E.164 string, which is the only unambiguous form once
 * records come from more than one country. Editing that as a single free-text
 * box put the burden of remembering a calling code on the operator, and made
 * "+880 1712 345678" and "01712-345678" two different values for one number.
 *
 * The stored value drives the country whenever it is complete enough to name
 * one, and the selection is held locally for while it is not — otherwise the
 * selector would snap back to the default between the first digit and the last.
 */
export function PhoneField({ label, labelId, value, error, onChange, onBlur }: PhoneFieldProps) {
  const [chosen, setChosen] = useState<CountryCode>(() => splitPhone(value).country);

  // An international number still being typed is shown as typed. It has no
  // country to read yet, and split as a national number it lost its plus on
  // the first keystroke and came out behind the wrong calling code.
  // Two parses of the numbering plans, so they happen when the value moves
  // rather than on every render the form causes around this field.
  const { country, national } = useMemo(
    () =>
      isPendingInternational(value)
        ? { country: chosen, national: value }
        : splitPhone(value, chosen),
    [value, chosen],
  );

  const change = (nextCountry: CountryCode, digits: string) => {
    setChosen(nextCountry);
    onChange(joinPhone(nextCountry, digits));
  };

  // A number typed or pasted with its own calling code names its country, and
  // the selector follows it rather than doubling the code onto the digits.
  const changeDigits = (typed: string) => {
    if (isPendingInternational(typed)) {
      onChange(typed);
      return;
    }

    const international = internationalPhone(typed, country);
    if (international === null) change(country, typed);
    else change(international.country, international.national);
  };

  return (
    <Box className="flex items-start gap-2">
      <TextField
        select
        size="small"
        value={country}
        onChange={(event) => change(event.target.value as CountryCode, national)}
        onBlur={onBlur}
        error={error !== undefined}
        sx={{ width: 120, flexShrink: 0 }}
        slotProps={{
          // Its own name: the country selector has no visible label of its own
          // to be named by, and "Phone" alone would describe both halves.
          htmlInput: { 'aria-label': `${label} country` },
          select: {
            renderValue: (code) => countryCodeLabel(code as CountryCode),
            // The menu is two hundred countries long, so it scrolls inside a
            // capped box rather than running past the top of the screen.
            MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } },
          },
        }}
      >
        {COUNTRY_OPTIONS}
      </TextField>

      <TextField
        size="small"
        fullWidth
        // The national digits as they are stored. Nothing groups them as they
        // are typed: the display would then be re-read as the value, and a
        // formatter that sometimes emits the calling code turns that into a
        // number that grows a country code per keystroke.
        value={national}
        placeholder={placeholderFor(country)}
        onChange={(event) => changeDigits(event.target.value)}
        onBlur={onBlur}
        error={error !== undefined}
        // On the number rather than the country: MUI wires helperText to the
        // input with aria-describedby, and the digits are what the message is
        // about. The blank keeps the row from resizing as errors come and go.
        helperText={error ?? ' '}
        slotProps={{
          htmlInput: {
            'aria-labelledby': labelId,
            inputMode: 'tel',
            autoComplete: 'tel-national',
          },
        }}
      />
    </Box>
  );
}
