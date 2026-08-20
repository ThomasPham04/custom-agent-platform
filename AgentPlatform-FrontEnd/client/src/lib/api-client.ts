import { apiUrl } from './api-host';
import type {
  DocumentDraft,
  DocumentPatch,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
} from '../types/knowledge';
import type { Message } from '../types/message';
import type { Run } from '../types/run';
import type { Session } from '../types/session';
import type { Trigger, TriggerDraft, TriggerPatch } from '../types/trigger';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const isErrorEnvelope = (value: unknown): value is { error: { code: string; message: string } } => {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => undefined);
  if (isErrorEnvelope(body)) {
    return new ApiError(response.status, body.error.code, body.error.message);
  }
  return new ApiError(
    response.status,
    `http_${response.status}`,
    `The server returned ${response.status}. Try again in a moment.`,
  );
};

const request = async (path: string, init?: RequestInit): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError(0, 'network_error', "Can't reach the server. Check that the API is running.");
  }
  if (!response.ok) throw await toApiError(response);
  return response;
};

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const apiGet = async <T>(path: string): Promise<T> =>
  (await request(path)).json() as Promise<T>;

export const apiPost = async <T>(path: string, body?: unknown): Promise<T> =>
  (await request(path, jsonInit('POST', body))).json() as Promise<T>;

export const apiPatch = async <T>(path: string, body: unknown): Promise<T> =>
  (await request(path, jsonInit('PATCH', body))).json() as Promise<T>;

export const apiDelete = async (path: string): Promise<void> => {
  await request(path, { method: 'DELETE' });
};

export const listSessions = (): Promise<Session[]> => apiGet<Session[]>('/api/sessions');

export const renameSession = (id: string, title: string): Promise<Session> =>
  apiPatch<Session>(`/api/sessions/${id}`, { title });

export const deleteSession = (id: string): Promise<void> => apiDelete(`/api/sessions/${id}`);

export const listRunsBySession = (sessionId: string): Promise<Run[]> =>
  apiGet<Run[]>(`/api/runs?sessionId=${encodeURIComponent(sessionId)}`);

interface SendMessageOptions {
  retry?: boolean;
  sessionId?: string;
}

export type ChatStreamEvent =
  | { type: 'session'; session: Session }
  | { type: 'textDelta'; text: string }
  | { type: 'toolStarted'; call: NonNullable<Message['toolCalls']>[number] }
  | {
      type: 'toolFinished';
      callId: string;
      result?: unknown;
      error?: string;
      durationMs: number;
      status: 'ok' | 'error';
    }
  | { type: 'done'; message: Message }
  | { type: 'error'; error: { code: string; message: string } };

/**
 * The response only carries `session` on the request that creates one: the
 * route sets response_model_exclude_none, so a later message's response omits
 * the key entirely rather than sending it as null. Check with `if (response.session)`.
 */
export const sendMessage = (
  agentId: string,
  content: string,
  options: SendMessageOptions = {},
): Promise<{ message: Message; session?: Session }> =>
  apiPost<{ message: Message; session?: Session }>(`/api/chat/${agentId}/messages`, {
    content,
    ...(options.retry ? { retry: true } : {}),
    ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
  });

/** Streams one chat turn as newline-delimited JSON, with JSON fallback for older servers. */
export const streamMessage = async (
  agentId: string,
  content: string,
  options: SendMessageOptions,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> => {
  const response = await request(
    `/api/chat/${agentId}/messages/stream`,
    jsonInit('POST', {
      content,
      ...(options.retry ? { retry: true } : {}),
      ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
    }),
  );

  if (!response.headers.get('Content-Type')?.includes('application/x-ndjson')) {
    const envelope = (await response.json()) as { message: Message; session?: Session };
    if (envelope.session) onEvent({ type: 'session', session: envelope.session });
    onEvent({ type: 'done', message: envelope.message });
    return;
  }

  if (!response.body) {
    throw new ApiError(0, 'stream_unavailable', 'The server returned no response stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let completed = false;

  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ChatStreamEvent;
    if (event.type === 'error') {
      throw new ApiError(502, event.error.code, event.error.message);
    }
    if (event.type === 'done') completed = true;
    onEvent(event);
  };

  while (true) {
    const { value, done } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    lines.forEach(consume);
    if (done) break;
  }
  consume(pending);

  if (!completed) {
    throw new ApiError(0, 'stream_incomplete', 'The response stream ended before completion.');
  }
};

export const listTriggers = (agentId?: string): Promise<Trigger[]> =>
  apiGet<Trigger[]>(
    agentId === undefined
      ? '/api/triggers'
      : `/api/triggers?agentId=${encodeURIComponent(agentId)}`,
  );

export const createTrigger = (draft: TriggerDraft): Promise<Trigger> =>
  apiPost<Trigger>('/api/triggers', draft);

export const updateTrigger = (id: string, patch: TriggerPatch): Promise<Trigger> =>
  apiPatch<Trigger>(`/api/triggers/${id}`, patch);

export const deleteTrigger = (id: string): Promise<void> => apiDelete(`/api/triggers/${id}`);

export const runTriggerNow = (id: string): Promise<Run> =>
  apiPost<Run>(`/api/triggers/${id}/run`);

export const listRunsByTrigger = (triggerId: string): Promise<Run[]> =>
  apiGet<Run[]>(`/api/runs?triggerId=${encodeURIComponent(triggerId)}`);

export const listDocuments = (): Promise<KnowledgeDocumentSummary[]> =>
  apiGet<KnowledgeDocumentSummary[]>('/api/knowledge/documents');

export const getDocument = (id: string): Promise<KnowledgeDocument> =>
  apiGet<KnowledgeDocument>(`/api/knowledge/documents/${encodeURIComponent(id)}`);

export const createDocument = (draft: DocumentDraft): Promise<KnowledgeDocument> =>
  apiPost<KnowledgeDocument>('/api/knowledge/documents', draft);

export const updateDocument = (id: string, patch: DocumentPatch): Promise<KnowledgeDocument> =>
  apiPatch<KnowledgeDocument>(`/api/knowledge/documents/${encodeURIComponent(id)}`, patch);

export const deleteDocument = (id: string): Promise<void> =>
  apiDelete(`/api/knowledge/documents/${encodeURIComponent(id)}`);
