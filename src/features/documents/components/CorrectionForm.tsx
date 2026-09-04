'use client';

import { useEffect, useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  NORMALIZED_FIELD_KEYS,
  NORMALIZED_FIELD_LABELS,
  type NormalizedRecord,
} from '@/domain/document';
import { fieldNeedsReview } from '@/domain/field';
import type { CorrectionInput } from '@/server/api-contract';
import {
  changedFields,
  correctionFormSchema,
  formValuesFrom,
  uncertainFields,
  type CorrectionFormValues,
} from '../correction';
import { CorrectionField } from './CorrectionField';
import { DocumentDateField } from './DocumentDateField';
import { PhoneField } from './PhoneField';

type CorrectionFormProps = {
  fields: NormalizedRecord;
  /** Whether the record is in the queue, which is what marks fields for attention. */
  underReview: boolean;
  isSaving: boolean;
  onSave: (corrections: CorrectionInput[]) => void;
};

/**
 * Lets an operator resolve an uncertain record rather than only look at it.
 *
 * Every field is editable, not only the flagged ones: extraction can be
 * confidently wrong, and an operator reading the scan should not have to fight
 * the interface to fix a value the pipeline was sure about.
 */
export function CorrectionForm({ fields, underReview, isSaving, onSave }: CorrectionFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionFormSchema),
    values: formValuesFrom(fields),
    mode: 'onBlur',
  });

  // A saved pass becomes the new baseline, so the form stops reporting itself
  // as dirty against values the server has already accepted.
  useEffect(() => {
    reset(formValuesFrom(fields));
  }, [fields, reset]);

  // One id per field, so each control is named by the caption above it rather
  // than by a second copy of the same words in an aria-label.
  const formId = useId();
  const labelId = (key: keyof NormalizedRecord) => `${formId}-${key}`;

  const flagged = (key: keyof NormalizedRecord) => underReview && fieldNeedsReview(fields[key]);
  const outstanding = NORMALIZED_FIELD_KEYS.filter(flagged);

  // Confirming five empty inputs is not the same claim as confirming five
  // uncertain values, and one label cannot honestly cover both. Extraction
  // finding nothing is the commoner case, so the wording has to say which.
  const confirmLabel = outstanding.every((key) => (fields[key].value ?? '') !== '')
    ? 'These values are correct'
    : 'Nothing more on the page';

  return (
    // The date adapter sits here rather than around the app: this form is the
    // only thing with a picker in it, and it is loaded on demand, so a provider
    // higher up would pull the adapter and its date library back into the
    // bundle every screen pays for.
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((values) => onSave(changedFields(fields, values)))}
        className="flex flex-col gap-3"
      >
        {NORMALIZED_FIELD_KEYS.map((key) => {
          const label = NORMALIZED_FIELD_LABELS[key];
          const message = errors[key]?.message;

          return (
            <CorrectionField
              key={key}
              label={label}
              labelId={labelId(key)}
              needsAttention={flagged(key)}
              corrected={fields[key].source === 'manual'}
            >
              {key === 'phone' || key === 'documentDate' ? (
                <Controller
                  name={key}
                  control={control}
                  render={({ field }) => {
                    const Field = key === 'phone' ? PhoneField : DocumentDateField;

                    return (
                      <Field
                        label={label}
                        labelId={labelId(key)}
                        value={field.value}
                        error={message}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    );
                  }}
                />
              ) : (
                <TextField
                  {...register(key)}
                  size="small"
                  fullWidth
                  error={message !== undefined}
                  // MUI wires helperText to the input with aria-describedby, and
                  // `error` sets aria-invalid, so the message is announced with
                  // the field rather than floating beside it.
                  helperText={message ?? ' '}
                  slotProps={{ htmlInput: { 'aria-labelledby': labelId(key) } }}
                />
              )}
            </CorrectionField>
          );
        })}

        <Box className="flex flex-wrap items-center gap-2">
          {/* Enabled whenever something changed, rather than gated on validity.
            Errors surface on blur, so a Save that greys out while a field is
            still being typed would withdraw the button without saying why;
            submitting runs the whole schema and shows what is wrong. */}
          <Button type="submit" variant="contained" disabled={!isDirty} loading={isSaving}>
            Save corrections
          </Button>

          {/* The pipeline is often merely unsure rather than wrong. Confirming is
            recorded as a correction, so the audit trail shows a person checked
            it instead of the flag quietly disappearing. */}
          {outstanding.length > 0 && !isDirty ? (
            <Button
              variant="outlined"
              loading={isSaving}
              onClick={() => onSave(uncertainFields(getValues(), flagged))}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
