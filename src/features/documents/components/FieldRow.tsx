'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { ConfidenceMeter } from '@/components/data/ConfidenceMeter';
import { FieldValue } from '@/components/data/FieldValue';
import { SOURCE_LABELS, fieldNeedsReview, isMissing, type ExtractedField } from '@/domain/field';

type FieldRowProps = {
  label: string;
  field: ExtractedField<string>;
  /**
   * Whether this document is actually awaiting review. A failed document has no
   * extracted values either, but flagging all five fields there would compete
   * with the failure notice that already explains why.
   */
  underReview?: boolean;
};

/**
 * One extracted field with everything known about it.
 *
 * Confidence is shown per field rather than per document because that is where
 * the uncertainty actually lives: a record can be perfectly readable except for
 * a phone number, and averaging that away is how an interface ends up
 * presenting a guess as a fact.
 */
export function FieldRow({ label, field, underReview = false }: FieldRowProps) {
  const missing = isMissing(field);
  const needsReview = underReview && fieldNeedsReview(field);

  return (
    <Box
      className="flex flex-col gap-1 rounded-lg px-3 py-2.5"
      sx={(theme) => ({
        backgroundColor: needsReview
          ? alpha(theme.palette.status.needs_review.fill, 0.08)
          : 'transparent',
        border: '1px solid',
        borderColor: needsReview
          ? alpha(theme.palette.status.needs_review.fill, 0.25)
          : 'transparent',
      })}
    >
      <Box className="flex items-baseline justify-between gap-3">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>

        {field.source === 'manual' ? (
          <Chip size="small" label="Corrected" sx={{ height: 20, fontSize: '0.7rem' }} />
        ) : null}
      </Box>

      <Box className="flex flex-wrap items-center justify-between gap-2">
        <FieldValue field={field} />

        {/* A missing value has no confidence to report; the absence is the
            information. Showing 0% would imply the pipeline read something. */}
        {missing ? null : <ConfidenceMeter score={field.confidence} />}
      </Box>

      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {missing ? 'Nothing found on the page' : SOURCE_LABELS[field.source]}
      </Typography>
    </Box>
  );
}
