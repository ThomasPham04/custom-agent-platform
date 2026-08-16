import { describe, expect, it } from 'vitest';
import { formatClockTime, formatDuration, formatJson, formatRelativeTime } from './format';

const now = new Date('2026-08-04T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it('reads "just now" inside a minute', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('just now');
    expect(formatRelativeTime(ago(59 * SECOND), now)).toBe('just now');
  });

  it('switches to minutes at exactly one minute', () => {
    expect(formatRelativeTime(ago(MINUTE), now)).toBe('1m ago');
    expect(formatRelativeTime(ago(59 * MINUTE), now)).toBe('59m ago');
  });

  it('switches to hours at exactly one hour', () => {
    expect(formatRelativeTime(ago(HOUR), now)).toBe('1h ago');
    expect(formatRelativeTime(ago(23 * HOUR), now)).toBe('23h ago');
  });

  it('switches to days at exactly one day', () => {
    expect(formatRelativeTime(ago(DAY), now)).toBe('1d ago');
    expect(formatRelativeTime(ago(6 * DAY), now)).toBe('6d ago');
  });

  it('falls back to a date at seven days', () => {
    expect(formatRelativeTime('2026-07-28T12:00:00.000Z', now)).toBe('28 Jul');
  });

  it('never reports a negative age for a clock skewed slightly ahead', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 5 * SECOND).toISOString(), now)).toBe(
      'just now',
    );
  });
});

describe('formatDuration', () => {
  it('reports milliseconds to two decimals below a second', () => {
    expect(formatDuration(118)).toBe('118.00 ms');
    expect(formatDuration(999)).toBe('999.00 ms');
    expect(formatDuration(117.6)).toBe('117.60 ms');
  });

  // An in-process tool answers in tens of microseconds. Whole milliseconds
  // truncated that to a bare "0 ms", which reads as "nothing ran".
  it('keeps a sub-millisecond call visible', () => {
    expect(formatDuration(0.0104)).toBe('0.01 ms');
    expect(formatDuration(0.19)).toBe('0.19 ms');
    expect(formatDuration(0)).toBe('0.00 ms');
  });

  it('reports seconds to one decimal from a second up', () => {
    expect(formatDuration(1000)).toBe('1.0 s');
    expect(formatDuration(1240)).toBe('1.2 s');
    expect(formatDuration(12500)).toBe('12.5 s');
  });
});

describe('formatClockTime', () => {
  it('zero-pads to hh:mm:ss', () => {
    expect(formatClockTime('2026-08-04T09:04:07.000Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('formatJson', () => {
  it('indents objects by two spaces', () => {
    expect(formatJson({ timezone: 'Asia/Tokyo' })).toBe('{\n  "timezone": "Asia/Tokyo"\n}');
  });

  it('quotes a bare string', () => {
    expect(formatJson('2026-08-04T21:03:41+09:00')).toBe('"2026-08-04T21:03:41+09:00"');
  });

  it('returns an empty string for undefined', () => {
    expect(formatJson(undefined)).toBe('');
  });

  it('survives a value it cannot serialise', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatJson(circular)).toBe('[unserialisable]');
  });
});
