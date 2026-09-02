'use client';

import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useColorScheme } from '@mui/material/styles';

// Switches between the light and dark palettes.
export function ColorSchemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();

  // Rendered on the server before the stored preference is known.
  if (!mode) return <IconButton disabled aria-hidden sx={{ width: 40, height: 40 }} />;

  const resolved = mode === 'system' ? systemMode : mode;
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} theme`;

  return (
    <Tooltip title={label}>
      <IconButton onClick={() => setMode(next)} aria-label={label} size="small">
        {resolved === 'dark' ? (
          <LightModeOutlinedIcon fontSize="small" />
        ) : (
          <DarkModeOutlinedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
