const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "just now" | "5m ago" | "2h ago" | "3d ago" | "28 Jul" */
export const formatRelativeTime = (iso: string, now: Date = new Date()): string => {
  // Clamp at zero: a server clock a few seconds ahead should not read "-1m ago".
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());

  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;
  return dateFormatter.format(new Date(iso));
};

/**
 * "118.00 ms" below a second, "1.2 s" at or above it.
 *
 * Two decimals because an in-process tool answers in tens of microseconds:
 * rounding to whole milliseconds printed "0 ms" and read as "nothing ran".
 */
export const formatDuration = (ms: number): string =>
  ms < SECOND ? `${ms.toFixed(2)} ms` : `${(ms / SECOND).toFixed(1)} s`;

/** Local wall-clock time, zero-padded: "21:04:12". */
export const formatClockTime = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** Two-space JSON for the trace code blocks. Never throws. */
export const formatJson = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '[unserialisable]';
  }
};
