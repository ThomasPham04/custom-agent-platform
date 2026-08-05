import {
  ANSWERS,
  FAILURE,
  FALLBACK_ANSWER,
  MODEL_TIME_MS,
  TOOL_FIXTURES,
  failureAnswer,
} from '../data/runs.js';
import { createId } from '../utils/ids.js';

const MAX_CALLS = 2;
const failuresAwaitingRetry = new Set();

const shouldFail = (content) => /\bfail/i.test(content);

const buildCall = (toolId) => {
  const fixture = TOOL_FIXTURES[toolId];
  return {
    id: createId('call'),
    toolId,
    args: structuredClone(fixture.args),
    result: structuredClone(fixture.result),
    durationMs: fixture.durationMs,
    status: 'ok',
  };
};

const failCall = (call) => ({
  id: call.id,
  toolId: call.toolId,
  args: call.args,
  error: FAILURE.error,
  durationMs: FAILURE.durationMs,
  status: 'error',
});

export const executeAgent = (agent, content) => {
  const toolIds = agent.toolIds.filter((id) => TOOL_FIXTURES[id]).slice(0, MAX_CALLS);
  let toolCalls = toolIds.map(buildCall);

  const failureKey = JSON.stringify([agent.id, content]);
  const failureRequested = toolCalls.length > 0 && shouldFail(content);
  const retrying = failureRequested && failuresAwaitingRetry.delete(failureKey);
  const failing = failureRequested && !retrying;
  if (failing) {
    failuresAwaitingRetry.add(failureKey);
    toolCalls = [...toolCalls.slice(0, -1), failCall(toolCalls.at(-1))];
  }

  const toolTime = toolCalls.reduce((total, call) => total + call.durationMs, 0);

  return {
    id: createId('msg'),
    role: 'assistant',
    content: failing ? failureAnswer(toolCalls.at(-1).toolId) : (ANSWERS[agent.id] ?? FALLBACK_ANSWER),
    toolCalls,
    model: agent.model,
    latencyMs: toolTime + MODEL_TIME_MS,
    status: failing ? 'error' : 'done',
    createdAt: new Date().toISOString(),
  };
};
