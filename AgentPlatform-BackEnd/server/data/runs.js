export const MODEL_TIME_MS = 180;

export const TOOL_FIXTURES = {
  current_time: {
    args: { timezone: 'Asia/Tokyo' },
    result: '2026-08-04T21:03:41+09:00',
    durationMs: 118,
  },
  http_request: {
    args: { url: 'https://status.example.com/health', method: 'GET' },
    result: { status: 200, latencyMs: 41, body: { state: 'healthy' } },
    durationMs: 412,
  },
  calculator: {
    args: { expression: '(184320 / 1024) * 0.87' },
    result: 156.6,
    durationMs: 24,
  },
  knowledge_search: {
    args: { query: 'refund window policy', limit: 3 },
    result: [
      { title: 'Refunds — 30 day window', score: 0.94 },
      { title: 'Proration on downgrade', score: 0.71 },
    ],
    durationMs: 268,
  },
};

export const FAILURE = {
  error: 'connection refused after 800ms',
  durationMs: 812,
};

export const ANSWERS = {
  agent_support: "It's 9:03 PM in Tokyo, and the status endpoint is healthy — 200 in 41 ms.",
  agent_research:
    'The refund window is 30 days from the invoice date. Downgrades prorate from the next cycle, not immediately.',
  agent_metrics: 'That works out to 156.6 GB billable, which is 87% of the 180 GB recorded.',
  agent_drafter:
    'This agent has no tools attached yet, so it can only answer from its system prompt.',
};

export const FALLBACK_ANSWER = 'Done. Expand a step above to see what each tool returned.';

export const failureAnswer = (toolId) =>
  `${toolId} failed: ${FAILURE.error}. Nothing was written, so retrying is safe.`;
