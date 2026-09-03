'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { alpha } from '@mui/material/styles';
import { CONFIDENCE_BAND_LABELS, type ConfidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/domain/document';
import { PROCESSING_STATUSES, STATUS_LABELS, type ProcessingStatus } from '@/domain/status';
import type { DocumentQueryInput } from '@/server/api-contract';
import { DocumentSearch } from './DocumentSearch';

const BANDS: ConfidenceBand[] = ['high', 'medium', 'low'];

type DocumentFiltersProps = {
  query: DocumentQueryInput;
  isFiltered: boolean;
  onChange: (patch: Partial<DocumentQueryInput>, history?: 'push' | 'replace') => void;
  onClear: () => void;
};

// Adds or removes one value from a multi-select filter.
function toggle<T>(values: readonly T[] | undefined, value: T): T[] {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function DocumentFilters({ query, isFiltered, onChange, onClear }: DocumentFiltersProps) {
  return (
    <Box className="mb-4 flex flex-col gap-3">
      <Box className="flex flex-wrap items-center gap-2">
        <DocumentSearch
          value={query.search ?? ''}
          // Starting a search is an action worth undoing, so it pushes.
          // Refining one only replaces, or every keystroke would bury the view
          // the operator actually wants to go back to.
          onChange={(search) =>
            onChange(
              { search: search.length > 0 ? search : undefined },
              (query.search ?? '') === '' ? 'push' : 'replace',
            )
          }
        />

        <TextField
          select
          size="small"
          label="Type"
          value={query.documentType?.[0] ?? ''}
          onChange={(event) =>
            onChange({
              documentType: event.target.value
                ? [event.target.value as (typeof DOCUMENT_TYPES)[number]]
                : undefined,
            })
          }
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="">All types</MenuItem>
          {DOCUMENT_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {DOCUMENT_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </TextField>

        {isFiltered ? (
          <Button size="small" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </Box>

      <Box
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter by status"
      >
        {PROCESSING_STATUSES.map((status: ProcessingStatus) => {
          const selected = query.status?.includes(status) ?? false;

          return (
            <Chip
              key={status}
              label={STATUS_LABELS[status]}
              size="small"
              variant={selected ? 'filled' : 'outlined'}
              onClick={() => onChange({ status: toggle(query.status, status) })}
              aria-pressed={selected}
              sx={(theme) => ({
                color: theme.palette.status[status].ink,
                borderColor: alpha(theme.palette.status[status].fill, 0.4),
                backgroundColor: selected
                  ? alpha(theme.palette.status[status].fill, 0.18)
                  : 'transparent',
              })}
            />
          );
        })}
      </Box>

      {/* Its own group. These sat inside "Filter by status", so every
          confidence chip was announced as a status filter. */}
      <Box
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter by confidence"
      >
        {BANDS.map((band) => {
          const selected = query.confidence?.includes(band) ?? false;

          return (
            <Chip
              key={band}
              label={CONFIDENCE_BAND_LABELS[band]}
              size="small"
              variant={selected ? 'filled' : 'outlined'}
              onClick={() => onChange({ confidence: toggle(query.confidence, band) })}
              aria-pressed={selected}
            />
          );
        })}
      </Box>
    </Box>
  );
}
