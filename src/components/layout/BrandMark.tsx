'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// The trust's name beside a small sun, since "Alo" means light.
export function BrandMark() {
  return (
    <Box className="flex items-center gap-2.5">
      <Box
        component="svg"
        viewBox="0 0 24 24"
        aria-hidden
        sx={{ width: 24, height: 24, flexShrink: 0, color: 'accent' }}
      >
        <circle cx="12" cy="12" r="5" fill="currentColor" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="11.25"
            y="1"
            width="1.5"
            height="3.5"
            rx="0.75"
            fill="currentColor"
            opacity="0.65"
            transform={`rotate(${angle} 12 12)`}
          />
        ))}
      </Box>

      <Box className="leading-tight">
        <Typography variant="h3" component="span" className="block" sx={{ fontSize: '1rem' }}>
          Alo Relief Trust
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Document console
        </Typography>
      </Box>
    </Box>
  );
}
