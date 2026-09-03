'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
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

  const flagged = (key: keyof NormalizedRecord) => underReview && fieldNeedsReview(fields[key]);
  const outstanding = NORMALIZED_FIELD_KEYS.filter(flagged);

  // Confirming five empty inputs is not the same claim as confirming five
  // uncertain values, and one label cannot honestly cover both. Extraction
  // finding nothing is the commoner case, so the wording has to say which.
  const confirmLabel = outstanding.every((key) => (fields[key].value ?? '') !== '')
    ? 'These values are correct'
    : 'Nothing more on the page';

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit((values) => onSave(changedFields(fields, values)))}
      className="flex flex-col gap-3"
    >
      {NORMALIZED_FIELD_KEYS.map((key) => {
        const error = errors[key];
        const needsAttention = flagged(key);

        return (
          <Box
            key={key}
            className="flex flex-col gap-1 rounded-lg p-2"
            sx={(theme) => ({
              backgroundColor: needsAttention
                ? alpha(theme.palette.status.needs_review.fill, 0.08)
                : 'transparent',
            })}
          >
            <Box className="flex items-center justify-between gap-2">
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {NORMALIZED_FIELD_LABELS[key]}
              </Typography>

              {fields[key].source === 'manual' ? (
                <Chip size="small" label="Corrected" sx={{ height: 20, fontSize: '0.7rem' }} />
              ) : needsAttention ? (
                <Typography variant="caption" sx={{ color: 'status.needs_review.ink' }}>
                  Needs checking
                </Typography>
              ) : null}
            </Box>

            <TextField
              {...register(key)}
              size="small"
              fullWidth
              error={error !== undefined}
              // MUI wires helperText to the input with aria-describedby, and
              // `error` sets aria-invalid, so the message is announced with the
              // field rather than floating beside it.
              helperText={error?.message ?? ' '}
              slotProps={{ htmlInput: { 'aria-label': NORMALIZED_FIELD_LABELS[key] } }}
            />
          </Box>
        );
      })}

      <Box className="flex flex-wrap items-center gap-2">
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
  );
}
