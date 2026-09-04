'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { EARLIEST_DOCUMENT_DATE } from '@/lib/date/isoDate';

const ISO = 'YYYY-MM-DD';

type DocumentDateFieldProps = {
  label: string;
  labelId: string;
  /** The stored day, as YYYY-MM-DD, or empty when the scan carried no date. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

function toDay(value: string): Dayjs | null {
  if (value === '') return null;

  const parsed = dayjs(value, ISO, true);
  return parsed.isValid() ? parsed : null;
}

/**
 * The document's own date, entered as a date rather than as text.
 *
 * A free-text box accepted 18/03/2024, March 18 and 2024-03-18 as three
 * different values for one day, and left the operator to guess which the
 * archive wanted. The picker fixes the order of the parts, keeps the day within
 * the month it belongs to, and refuses a future date in the calendar.
 *
 * The stored value stays a string, because that is what the archive holds and
 * what a correction sends. While a date is half typed the picker reports an
 * invalid day on every keystroke; those are ignored rather than written, so a
 * partly typed year cannot wipe the value that was there.
 */
export function DocumentDateField({
  label,
  labelId,
  value,
  error,
  onChange,
  onBlur,
}: DocumentDateFieldProps) {
  return (
    <DatePicker
      label={undefined}
      format={ISO}
      value={toDay(value)}
      onChange={(next) => {
        if (next === null) onChange('');
        else if (next.isValid()) onChange(next.format(ISO));
      }}
      // The calendar cannot offer a day the schema would reject. Typing still
      // can, which is why the same two rules are checked again on submit.
      disableFuture
      minDate={dayjs(EARLIEST_DOCUMENT_DATE, ISO, true)}
      slotProps={{
        textField: {
          size: 'small',
          fullWidth: true,
          onBlur,
          error: error !== undefined,
          helperText: error ?? ' ',
          // The name has to reach the element holding the day, month and year
          // sections, which is the only node a screen reader announces as the
          // field. Nothing shallower on this slot chain reaches it.
          slotProps: { input: { 'aria-labelledby': labelId } },
        },
        openPickerButton: { 'aria-label': `Choose ${label.toLowerCase()}` },
      }}
    />
  );
}
