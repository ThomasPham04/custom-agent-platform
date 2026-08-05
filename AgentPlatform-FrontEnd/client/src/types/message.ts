export type ToolCallStatus = 'running' | 'ok' | 'error';

export interface ToolCall {
  id: string;
  toolId: string;
  args: unknown;
  result?: unknown;
  error?: string;
  durationMs: number;
  status: ToolCallStatus;
}

export type MessageRole = 'user' | 'assistant';
export type MessageStatus = 'thinking' | 'done' | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  model?: string;
  latencyMs?: number;
  status: MessageStatus;
  createdAt: string;
}
