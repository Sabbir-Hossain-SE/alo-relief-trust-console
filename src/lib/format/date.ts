const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// Renders a date unambiguously, since 09/02/26 means two things.
export function formatDate(epochMs: number): string {
  return DATE_FORMAT.format(new Date(epochMs));
}

export function formatDateTime(epochMs: number): string {
  return DATE_TIME_FORMAT.format(new Date(epochMs));
}

// Renders a duration as the coarsest useful unit.
export function formatDuration(ms: number): string {
  if (ms < 1000) return 'under a second';

  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
