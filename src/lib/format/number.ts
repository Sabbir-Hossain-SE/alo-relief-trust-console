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
