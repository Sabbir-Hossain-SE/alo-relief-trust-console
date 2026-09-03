'use client';

import { useId } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { brandMark } from '@/theme/tokens';

type BrandMarkProps = {
  /** Drops the second line, for the bar where there is one line of room. */
  compact?: boolean;
};

/**
 * The sun rising over a page edge, since "Alo" means light.
 *
 * Only the horizon follows the scheme, through the palette rather than a media
 * query, so it tracks the in-app theme toggle and not just the operating
 * system's. The sun is the same in both: it reads on either ground, and
 * inverting it would cost the mark its identity to fix nothing.
 */
function Mark() {
  // The small-screen drawer keeps its content mounted, so this renders twice on
  // one page. A fixed gradient id would be a duplicate in the document, and
  // `url(#id)` resolves against the first match.
  const gradientId = useId();

  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      aria-hidden
      sx={{ width: 26, height: 26, flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brandMark.coreTop} />
          <stop offset="1" stopColor={brandMark.coreBottom} />
        </linearGradient>
      </defs>

      <g stroke={brandMark.ray} strokeWidth="4.5" strokeLinecap="round">
        <line x1="32" y1="14" x2="32" y2="7" />
        <line x1="17.6" y1="19.6" x2="12.6" y2="14.6" />
        <line x1="46.4" y1="19.6" x2="51.4" y2="14.6" />
        <line x1="11.5" y1="33" x2="4.5" y2="33" />
        <line x1="52.5" y1="33" x2="59.5" y2="33" />
      </g>

      <path d="M 15 44 A 17 17 0 0 1 49 44 Z" fill={`url(#${gradientId})`} />

      {/* Taken from `vars`, not from `palette`. `fill` is not one of the
          properties MUI maps to palette keys, so a token name is passed through
          as a raw CSS value and paints black; and `palette` resolves to the
          literal for whichever scheme rendered first, which bakes that colour
          into the stylesheet and leaves the mark unchanged when the operator
          uses the theme toggle. The variable is the only form that follows it. */}
      <Box
        component="rect"
        x="6"
        y="48"
        width="52"
        height="5"
        rx="2.5"
        sx={(theme) => ({ fill: theme.vars?.palette.brandHorizon ?? theme.palette.brandHorizon })}
      />
    </Box>
  );
}

// The trust's name beside the mark.
export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <Box className="flex items-center gap-2.5">
      <Mark />

      <Box className="leading-tight">
        <Typography variant="h3" component="span" className="block" sx={{ fontSize: '1rem' }}>
          Alo Relief Trust
        </Typography>
        {compact ? null : (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Document console
          </Typography>
        )}
      </Box>
    </Box>
  );
}
