import type { Message, ToolCall } from '../types/message';
import type { Run, RunToolCall } from '../types/run';

/**
 * A run row is a chat turn: the request stored the user's message, the answer,
 * the model, the latency, and the ordered tool calls. Rehydrating a thread is
 * therefore a mapping, not a reconstruction.
 */

const toToolCall = (call: RunToolCall): ToolCall => ({
  id: call.id,
  toolId: call.toolId,
  args: call.args,
  // The wire sends explicit nulls where ToolCall expects the key to be absent,
  // and the trace rail renders "no result" differently from a result of null.
  ...(call.result === null ? {} : { result: call.result }),
  ...(call.error === null ? {} : { error: call.error }),
  durationMs: call.durationMs,
  status: call.status,
});

const toTurn = (run: Run): Message[] => [
  {
    // The user's own message id was never stored, so it is derived from the
    // run's. Ids only need to be stable and unique within the thread.
    id: `${run.id}_user`,
    role: 'user',
    content: run.userMessage,
    status: 'done',
    createdAt: run.createdAt,
  },
  {
    id: run.id,
    role: 'assistant',
    content: run.answer,
    toolCalls: [...run.toolCalls].sort((a, b) => a.seq - b.seq).map(toToolCall),
    model: run.model,
    latencyMs: run.latencyMs,
    // RunStatus and MessageStatus agree on 'done' and 'error'; only the live
    // 'thinking' placeholder has no run equivalent.
    status: run.status,
    createdAt: run.createdAt,
  },
];

/** The API returns newest first; a thread reads oldest first. */
export const runsToMessages = (runs: readonly Run[]): Message[] =>
  [...runs]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .flatMap(toTurn);
