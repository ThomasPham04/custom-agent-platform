import { describe, expect, it } from 'vitest';
import {
  scheduleLabel,
  triggerPatch,
  triggerToDraft,
  whenLabel,
} from './trigger-schedule';
import type { Trigger, TriggerDraft } from '../types/trigger';

const trigger = (overrides: Partial<Trigger> = {}): Trigger => ({
  id: 'trg_1',
  agentId: 'agent_support',
  name: 'Support check',
  message: 'Check support.',
  kind: 'daily',
  intervalMinutes: null,
  timeOfDay: '09:00',
  weekdays: [0, 1, 2, 3, 4],
  timezone: 'Asia/Ho_Chi_Minh',
  enabled: true,
  nextRunAt: '2026-08-21T02:00:00Z',
  lastRunAt: null,
  lastStatus: null,
  lastRunId: null,
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
  ...overrides,
});

describe('trigger schedule labels', () => {
  it('describes interval schedules in readable units', () => {
    expect(
      scheduleLabel(
        trigger({ kind: 'interval', intervalMinutes: 60, timeOfDay: null, weekdays: [] }),
      ),
    ).toBe('Every hour - Asia/Ho_Chi_Minh');
    expect(
      scheduleLabel(
        trigger({ kind: 'interval', intervalMinutes: 15, timeOfDay: null, weekdays: [] }),
      ),
    ).toBe('Every 15 minutes - Asia/Ho_Chi_Minh');
  });

  it('collapses contiguous weekdays into a range', () => {
    expect(scheduleLabel(trigger())).toBe(
      'Daily at 09:00 - Mon to Fri - Asia/Ho_Chi_Minh',
    );
    expect(scheduleLabel(trigger({ weekdays: [] }))).toBe(
      'Daily at 09:00 - Every day - Asia/Ho_Chi_Minh',
    );
  });

  it('uses a dash for a missing activity timestamp', () => {
    expect(whenLabel(null)).toBe('—');
  });
});

describe('trigger editor conversion', () => {
  it('converts nullable wire schedule fields to an editable draft', () => {
    expect(triggerToDraft(trigger({ kind: 'interval', intervalMinutes: 30 }))).toEqual({
      agentId: 'agent_support',
      kind: 'interval',
      message: 'Check support.',
      name: 'Support check',
      intervalMinutes: 30,
      timeOfDay: '09:00',
      weekdays: [0, 1, 2, 3, 4],
      timezone: 'Asia/Ho_Chi_Minh',
      enabled: true,
    });
  });

  it('returns only fields that changed', () => {
    const baseline = trigger();
    const edited: TriggerDraft = {
      ...triggerToDraft(baseline),
      name: 'Morning support check',
      timeOfDay: '10:30',
      weekdays: [0, 2, 4],
    };

    expect(triggerPatch(baseline, edited)).toEqual({
      name: 'Morning support check',
      timeOfDay: '10:30',
      weekdays: [0, 2, 4],
    });
    expect(triggerPatch(baseline, triggerToDraft(baseline))).toEqual({});
  });
});
