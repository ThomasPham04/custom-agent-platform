export type RunStatus = 'done' | 'error';
export type RunCallStatus = 'ok' | 'error';

/**
 * GET /api/runs does not set response_model_exclude_none, so absent values
 * arrive as explicit nulls rather than missing keys. These fields are nullable,
 * not optional.
 */
export interface RunToolCall {
  id: string;
  seq: number;
  toolId: string;
  args: unknown;
  result: unknown;
  error: string | null;
  durationMs: number;
  status: RunCallStatus;
}

export interface Run {
  id: string;
  agentId: string;
  agentName: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  answer: string;
  status: RunStatus;
  error: string | null;
  latencyMs: number;
  sessionId: string | null;
  createdAt: string;
  toolCalls: RunToolCall[];
}
