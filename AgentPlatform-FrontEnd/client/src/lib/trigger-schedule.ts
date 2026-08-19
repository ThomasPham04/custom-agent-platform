import type { Trigger, TriggerDraft, TriggerPatch } from '../types/trigger';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SCHEDULED_MESSAGE = 'Perform the scheduled task described in your system prompt.';

type IntlWithTimezones = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

/** Every canonical IANA zone supported by the browser, with UTC kept explicit. */
const SUPPORTED_TIMEZONES = [
  'UTC',
  ...((Intl as IntlWithTimezones).supportedValuesOf?.('timeZone') ?? []),
];

export const timezoneOptions = (current?: string): string[] =>
  [...new Set(current ? [current, ...SUPPORTED_TIMEZONES] : SUPPORTED_TIMEZONES)].sort();

/** The zone the user is actually in, so the common case needs no thought. */
export const browserTimezone = (): string => {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return resolved ? resolved : 'UTC';
};

const everyLabel = (minutes: number): string => {
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = minutes / 60;
    return hours === 1 ? 'Every hour' : `Every ${hours} hours`;
  }
  return minutes === 1 ? 'Every minute' : `Every ${minutes} minutes`;
};

const daysLabel = (weekdays: number[]): string => {
  if (weekdays.length === 0) return 'Every day';
  const sorted = [...weekdays].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (day, index) => index === 0 || day === sorted[index - 1]! + 1,
  );
  if (contiguous && sorted.length > 2) {
    return `${DAY_LABELS[sorted[0]!]} to ${DAY_LABELS[sorted[sorted.length - 1]!]}`;
  }
  return sorted.map((day) => DAY_LABELS[day]).join(', ');
};

type TriggerSchedule = Pick<Trigger, 'kind'> &
  Partial<Pick<Trigger, 'intervalMinutes' | 'timeOfDay' | 'weekdays' | 'timezone'>>;

/** One line a person can read, e.g. "Daily at 09:00 - Mon to Fri - Asia/Ho_Chi_Minh". */
export const scheduleLabel = (trigger: TriggerSchedule): string => {
  if (trigger.kind === 'interval') {
    return `${everyLabel(trigger.intervalMinutes ?? 1)} - ${trigger.timezone ?? 'UTC'}`;
  }
  return `Daily at ${trigger.timeOfDay ?? '00:00'} - ${daysLabel(trigger.weekdays ?? [])} - ${trigger.timezone ?? 'UTC'}`;
};

/** An absolute time, or a dash when the server has none yet. */
export const whenLabel = (value: string | null): string =>
  value === null ? '—' : new Date(value).toLocaleString();

export const newTriggerDraft = (agentId: string): TriggerDraft => ({
  agentId,
  kind: 'daily',
  message: SCHEDULED_MESSAGE,
  name: 'Scheduled run',
  timeOfDay: '09:00',
  weekdays: [],
  timezone: browserTimezone(),
  enabled: true,
});

/**
 * A Trigger is not a TriggerDraft: the server sends `null` for the schedule
 * field the other kind owns, and the writable type uses `undefined`. Passing a
 * Trigger straight into the form is a type error, so the conversion lives here.
 */
export const triggerToDraft = (trigger: Trigger): TriggerDraft => ({
  agentId: trigger.agentId,
  kind: trigger.kind,
  message: trigger.message,
  name: trigger.name,
  intervalMinutes: trigger.intervalMinutes ?? undefined,
  timeOfDay: trigger.timeOfDay ?? undefined,
  weekdays: trigger.weekdays,
  timezone: trigger.timezone,
  enabled: trigger.enabled,
});

const sameDays = (left: readonly number[], right: readonly number[]) =>
  left.length === right.length && left.every((day, index) => day === right[index]);

/** Only fields owned by the form, and only when they differ from the open trigger. */
export const triggerPatch = (baseline: Trigger, edited: TriggerDraft): TriggerPatch => {
  const patch: TriggerPatch = {};
  if (baseline.agentId !== edited.agentId) patch.agentId = edited.agentId;
  if (edited.name !== undefined && baseline.name !== edited.name) patch.name = edited.name;
  if (baseline.message !== edited.message) patch.message = edited.message;
  if (baseline.kind !== edited.kind) patch.kind = edited.kind;
  if (
    edited.kind === 'interval' &&
    baseline.intervalMinutes !== (edited.intervalMinutes ?? 60)
  ) {
    patch.intervalMinutes = edited.intervalMinutes ?? 60;
  }
  if (edited.kind === 'daily') {
    if (baseline.timeOfDay !== (edited.timeOfDay ?? '09:00')) {
      patch.timeOfDay = edited.timeOfDay ?? '09:00';
    }
    const weekdays = edited.weekdays ?? [];
    if (!sameDays(baseline.weekdays, weekdays)) patch.weekdays = weekdays;
  }
  if (edited.timezone !== undefined && baseline.timezone !== edited.timezone) {
    patch.timezone = edited.timezone;
  }
  return patch;
};
