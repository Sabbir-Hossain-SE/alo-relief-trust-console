const COUNT_FORMAT = new Intl.NumberFormat('en-GB');

// Renders a count with thousands separators.
export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value);
}

// Renders a share of a total as a whole percentage.
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

// Renders a file size in the largest unit that keeps it readable.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}
