export type TriggerKind = 'interval' | 'daily';
export type TriggerLastStatus = 'done' | 'error';

/**
 * GET /api/triggers does not set response_model_exclude_none, so absent values
 * arrive as explicit nulls rather than missing keys — the same rule as Run.
 */
export interface Trigger {
  id: string;
  agentId: string;
  name: string;
  message: string;
  kind: TriggerKind;
  intervalMinutes: number | null;
  timeOfDay: string | null;
  /** Monday is 0. Empty means every day. */
  weekdays: number[];
  timezone: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: TriggerLastStatus | null;
  lastRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The writable surface. Everything else is server-owned. */
export interface TriggerPatch {
  agentId?: string;
  name?: string;
  message?: string;
  kind?: TriggerKind;
  intervalMinutes?: number;
  timeOfDay?: string;
  weekdays?: number[];
  timezone?: string;
  enabled?: boolean;
}

/** A create body: agentId, kind, and message are required by the server. */
export interface TriggerDraft extends TriggerPatch {
  agentId: string;
  kind: TriggerKind;
  message: string;
}
