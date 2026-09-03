'use client';

import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import { setDensity, type GridDensity } from '@/store/preferences';
import { useAppDispatch } from '@/store/hooks';
import { usePreferences } from '@/store/usePreferences';

// Row height is a matter of taste and screen size, so it is remembered per operator.
export function DensityToggle() {
  const dispatch = useAppDispatch();
  const { density } = usePreferences();

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={density}
      onChange={(_event, next: GridDensity | null) => {
        if (next !== null) dispatch(setDensity(next));
      }}
      aria-label="Row density"
    >
      <ToggleButton value="comfortable" aria-label="Comfortable rows">
        <Tooltip title="Comfortable rows">
          <DensityMediumIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="compact" aria-label="Compact rows">
        <Tooltip title="Compact rows">
          <DensitySmallIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
