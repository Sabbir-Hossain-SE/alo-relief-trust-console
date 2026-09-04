'use client';

import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import type { ConfidenceBand } from '@/domain/confidence';
import { radii } from '@/theme/tokens';
import type { ProcessingStatus } from '@/domain/status';
import type { DocumentQueryInput } from '@/server/api-contract';
import { ConfidenceFilterChips, StatusFilterChips } from './FilterChips';
import { TypeFilter } from './TypeFilter';

type FilterSheetProps = {
  open: boolean;
  query: DocumentQueryInput;
  isFiltered: boolean;
  onClose: () => void;
  onChange: (patch: Partial<DocumentQueryInput>) => void;
  onClear: () => void;
  onToggleStatus: (status: ProcessingStatus) => void;
  onToggleConfidence: (band: ConfidenceBand) => void;
};

/**
 * The filters on a phone, in a sheet rather than in the page.
 *
 * Laid out down the page the same controls take a third of a small screen
 * before a single row of the archive is visible, which is the wrong trade on
 * the device with the least room: the grid is what the operator came for, and
 * filters are something they reach for occasionally.
 *
 * Changes apply as they are made rather than on a confirm step, because they
 * already drive the URL and a sheet that batched them would be the only place
 * in the app where a filter did not take effect when it was set. The button
 * that closes the sheet therefore says what it does — it shows the results
 * rather than applying anything.
 */
export function FilterSheet({
  open,
  query,
  isFiltered,
  onClose,
  onChange,
  onClear,
  onToggleStatus,
  onToggleConfidence,
}: FilterSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // Targeted through the drawer rather than set on the paper slot: the
      // theme squares off every drawer paper, for the navigation rail and the
      // document panel that run the full height of the window. A sheet rising
      // from the bottom has one edge facing the page, and a two-class selector
      // settles which rule wins without depending on injection order.
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: radii.overlay,
          borderTopRightRadius: radii.overlay,
        },
      }}
      slotProps={{
        paper: {
          // dvh where the browser has it: on iOS, vh is the viewport with the
          // toolbar hidden, so a sheet sized by it ran under the toolbar and
          // its buttons were the part that was cut off.
          sx: { maxHeight: '85vh', '@supports (height: 1dvh)': { maxHeight: '85dvh' } },
          role: 'dialog',
          'aria-modal': true,
          'aria-label': 'Filters',
        },
      }}
    >
      <Box className="flex items-center justify-between gap-2 p-4 pb-2">
        <Typography variant="h3" component="h2">
          Filters
        </Typography>
        <IconButton size="small" aria-label="Close filters" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Divider />

      <Box className="flex flex-col gap-4 overflow-y-auto p-4">
        <TypeFilter
          fullWidth
          selected={query.documentType?.[0]}
          onChange={(type) => onChange({ documentType: type === undefined ? undefined : [type] })}
        />

        {/* Headings here but not in the bar: stacked down a sheet, three chips
            reading "High Medium Low" under a type filter name nothing. On one
            line beside the statuses a rule is enough to say they are a
            different question. */}
        <Box className="flex flex-col gap-1.5">
          <Typography variant="caption" sx={{ color: 'text.secondary' }} aria-hidden>
            Status
          </Typography>
          <StatusFilterChips selected={query.status ?? []} onToggle={onToggleStatus} />
        </Box>

        <Box className="flex flex-col gap-1.5">
          <Typography variant="caption" sx={{ color: 'text.secondary' }} aria-hidden>
            Confidence
          </Typography>
          <ConfidenceFilterChips selected={query.confidence ?? []} onToggle={onToggleConfidence} />
        </Box>
      </Box>

      <Divider />

      <Box className="flex items-center justify-between gap-2 p-4">
        <Button size="small" onClick={onClear} disabled={!isFiltered}>
          Clear all
        </Button>
        <Button variant="contained" onClick={onClose}>
          Show results
        </Button>
      </Box>
    </Drawer>
  );
}
