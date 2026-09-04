'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { formatCount, formatPercent } from '@/lib/format/number';
import { barShare } from '../breakdowns';

export type BreakdownRow = {
  key: string;
  label: string;
  count: number;
  href: string;
};

type BreakdownCardProps = {
  title: string;
  /** What the figures are actually about, when that is not the whole archive. */
  caption: string;
  rows: readonly BreakdownRow[];
  /** What the shares are measured against. */
  total: number;
  emptyMessage: string;
};

/** One breakdown of the archive, every row a way into the documents it counts. */
export function BreakdownCard({ title, caption, rows, total, emptyMessage }: BreakdownCardProps) {
  const peak = rows.reduce((max, row) => Math.max(max, row.count), 0);

  return (
    <Paper className="flex flex-col gap-4 p-6">
      <Box>
        <Typography variant="h3" component="h3">
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {caption}
        </Typography>
      </Box>

      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <Box component="ul" className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((row) => (
            <Box component="li" key={row.key}>
              <Box
                component={Link}
                href={row.href}
                className="flex flex-col gap-1 rounded-lg px-2 py-1.5"
                aria-label={`${formatCount(row.count)} ${row.label.toLowerCase()} — open in documents`}
                sx={(theme) => ({
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background-color 200ms',
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
                })}
              >
                <Box className="flex items-baseline justify-between gap-3">
                  <Typography variant="body2" className="min-w-0 truncate">
                    {row.label}
                  </Typography>
                  <Typography variant="body2" className="figures shrink-0">
                    {formatCount(row.count)}
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                      {' '}
                      · {formatPercent(row.count, total)}
                    </Typography>
                  </Typography>
                </Box>

                <Box
                  className="h-1 w-full overflow-hidden rounded-full"
                  sx={(theme) => ({ backgroundColor: alpha(theme.palette.primary.main, 0.12) })}
                >
                  <Box
                    className="h-full rounded-full"
                    sx={{
                      width: `${Math.round(barShare(row.count, peak) * 100)}%`,
                      backgroundColor: 'primary.main',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
