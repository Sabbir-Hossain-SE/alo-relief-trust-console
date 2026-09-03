'use client';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { ConfidenceMeter } from './ConfidenceMeter';
import { SOURCE_LABELS, fieldNeedsReview, isMissing, type ExtractedField } from '@/domain/field';

type FieldValueProps<T> = {
  field: ExtractedField<T>;
  format?: (value: T) => string;
  mono?: boolean;
};

// Renders an extracted value together with how much it can be trusted, so
// missing and uncertain data stay visible instead of looking like fact.
export function FieldValue<T>({ field, format, mono = false }: FieldValueProps<T>) {
  if (isMissing(field)) {
    return (
      <Box className="flex items-center gap-1.5">
        <HelpOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
          Not found
        </Typography>
      </Box>
    );
  }

  const text = format ? format(field.value as T) : String(field.value);
  const isManual = field.source === 'manual';

  return (
    <Box className="flex items-center gap-2">
      <Typography
        variant="body2"
        className={mono ? 'tabular' : undefined}
        sx={{ fontWeight: fieldNeedsReview(field) ? 600 : 400 }}
      >
        {text}
      </Typography>

      {isManual ? (
        <Tooltip title={SOURCE_LABELS.manual}>
          <Box
            component="span"
            className="inline-flex"
            role="img"
            aria-label={SOURCE_LABELS.manual}
          >
            <PersonOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          </Box>
        </Tooltip>
      ) : (
        <ConfidenceMeter score={field.confidence} showLabel={false} />
      )}
    </Box>
  );
}
