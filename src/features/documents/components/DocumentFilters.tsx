'use client';

import { useState } from 'react';
import ClearIcon from '@mui/icons-material/Clear';
import TuneIcon from '@mui/icons-material/Tune';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import type { ConfidenceBand } from '@/domain/confidence';
import type { ProcessingStatus } from '@/domain/status';
import type { DocumentQueryInput } from '@/server/api-contract';
import { activeFilters } from '../activeFilters';
import { DocumentSearch } from './DocumentSearch';
import { ConfidenceFilterChips, StatusFilterChips } from './FilterChips';
import { FilterSheet } from './FilterSheet';
import { TypeFilter } from './TypeFilter';

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

/**
 * The filter bar, which is two different shapes rather than one that wraps.
 *
 * Wide enough, every chip is a target an operator can hit without opening
 * anything, and the whole set is one line under the search. On a phone the same
 * set laid down the page cost a third of the screen, so it moves into a sheet
 * and leaves behind a count and the filters actually applied.
 *
 * The switch is a media query rather than two hidden copies: duplicating the
 * chips would put two "Filter by status" groups in the accessibility tree, and
 * both would answer to the same name. Safe against hydration here because this
 * whole view renders behind the mock backend's gate.
 */
export function DocumentFilters({ query, isFiltered, onChange, onClear }: DocumentFiltersProps) {
  const theme = useTheme();
  const roomForChips = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [sheetOpen, setSheetOpen] = useState(false);

  const applied = activeFilters(query);

  const toggleStatus = (status: ProcessingStatus) =>
    onChange({ status: toggle(query.status, status) });
  const toggleConfidence = (band: ConfidenceBand) =>
    onChange({ confidence: toggle(query.confidence, band) });

  const search = (
    <DocumentSearch
      value={query.search ?? ''}
      // Starting a search is an action worth undoing, so it pushes. Refining one
      // only replaces, or every keystroke would bury the view the operator
      // actually wants to go back to.
      onChange={(next) =>
        onChange(
          { search: next.length > 0 ? next : undefined },
          (query.search ?? '') === '' ? 'push' : 'replace',
        )
      }
    />
  );

  const clearButton = isFiltered ? (
    // The same cross the search field clears itself with, so one mark means
    // "undo this narrowing" wherever it appears in the row.
    <Button size="small" onClick={onClear} startIcon={<ClearIcon fontSize="small" />}>
      Clear filters
    </Button>
  ) : null;

  if (!roomForChips) {
    return (
      <Box className="flex flex-col gap-2">
        <Box className="flex items-start gap-2">
          <Box className="min-w-0 flex-1">{search}</Box>

          <Badge badgeContent={applied.length} color="primary" overlap="circular">
            <Button
              variant="outlined"
              onClick={() => setSheetOpen(true)}
              startIcon={<TuneIcon fontSize="small" />}
              sx={{ flexShrink: 0, height: 40 }}
            >
              Filters
            </Button>
          </Badge>
        </Box>

        {/* What is on, without opening anything. One line that scrolls rather
            than a block that grows: on the screen this layout exists to save,
            a filter set that reflows is the thing being avoided. */}
        {applied.length > 0 ? (
          <Box
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="group"
            aria-label="Filters applied"
            sx={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
          >
            {applied.map((filter) => (
              <Chip
                key={filter.id}
                label={filter.label}
                size="small"
                // Clickable as a whole, not only on the cross. A chip that is
                // only a label until the eight pixels of its icon is a target
                // nobody hits first time on a phone; the cross stays as the
                // affordance that says what the tap will do.
                onClick={() => onChange(filter.patch)}
                onDelete={() => onChange(filter.patch)}
                deleteIcon={<ClearIcon fontSize="small" />}
                aria-label={`${filter.label} — remove filter`}
                sx={{ flexShrink: 0 }}
              />
            ))}
          </Box>
        ) : null}

        <FilterSheet
          open={sheetOpen}
          query={query}
          isFiltered={isFiltered}
          onClose={() => setSheetOpen(false)}
          onChange={onChange}
          onClear={onClear}
          onToggleStatus={toggleStatus}
          onToggleConfidence={toggleConfidence}
        />
      </Box>
    );
  }

  return (
    <Box className="flex flex-col gap-2">
      <Box className="flex flex-wrap items-center gap-2">
        {search}

        <TypeFilter
          selected={query.documentType?.[0]}
          onChange={(type) => onChange({ documentType: type === undefined ? undefined : [type] })}
        />

        {clearButton}
      </Box>

      {/* One line, always. A rule rather than a heading separates the two
          kinds of filter: a visible "Confidence" label costs more width than
          the three chips behind it, and the chips still carry the full phrase
          as their accessible name. */}
      <Box
        className="flex items-center gap-2 overflow-x-auto"
        sx={{
          flexWrap: 'nowrap',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          '& > *': { flexShrink: 0, flexWrap: 'nowrap' },
        }}
      >
        <StatusFilterChips selected={query.status ?? []} onToggle={toggleStatus} />
        {/* Deliberately stronger than a hairline. `divider` is tuned for the
            edge of a surface, where the shape either side does the work; here
            the rule is the only thing saying these are two questions, so at
            0.12 alpha it read as an accident of spacing. */}
        <Divider
          orientation="vertical"
          flexItem
          sx={(theme) => ({
            alignSelf: 'center',
            height: 18,
            borderColor: alpha(theme.palette.text.secondary, 0.45),
          })}
        />
        <ConfidenceFilterChips selected={query.confidence ?? []} onToggle={toggleConfidence} />
      </Box>
    </Box>
  );
}
