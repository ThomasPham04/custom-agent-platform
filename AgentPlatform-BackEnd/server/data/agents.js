export const DEFAULT_MODEL = 'gemini-2.5-flash';

export const MODEL_IDS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

export const AGENT_DEFAULTS = {
  name: 'New agent',
  icon: '🧩',
  description: '',
  model: DEFAULT_MODEL,
  systemPrompt: '',
  toolIds: [],
  status: 'draft',
};

// Fixed timestamps keep the seeded relative times stable and reviewable.
const HOURS = 60 * 60 * 1000;
const base = new Date('2026-08-04T12:00:00.000Z').getTime();
const at = (hoursAgo) => new Date(base - hoursAgo * HOURS).toISOString();

export const SEED_AGENTS = [
  {
    id: 'agent_support',
    name: 'Support Bot',
    icon: '🎧',
    description: 'Answers billing and account questions for the support inbox.',
    model: 'gemini-2.5-flash',
    systemPrompt:
      'You are the support agent for a subscription product.\n\n' +
      'Answer in two sentences or fewer. Quote exact policy numbers rather than\n' +
      'paraphrasing them. When a question needs the current time or a live status\n' +
      'check, call the tool instead of guessing. If you cannot answer from the\n' +
      'tools and the policy text, say so and offer to escalate.',
    toolIds: ['current_time', 'http_request'],
    status: 'active',
    createdAt: at(720),
    updatedAt: at(2),
  },
  {
    id: 'agent_research',
    name: 'Research Assistant',
    icon: '🔭',
    description: 'Gathers sources and summarises them with citations.',
    model: 'gemini-2.5-pro',
    systemPrompt:
      'You research questions and report findings with citations.\n\n' +
      'Search the knowledge base before reaching for the web. Show your arithmetic\n' +
      'through the calculator tool rather than doing it in your head.',
    toolIds: ['knowledge_search', 'http_request', 'calculator'],
    status: 'active',
    createdAt: at(600),
    updatedAt: at(24),
  },
  {
    id: 'agent_metrics',
    name: 'Metrics Analyst',
    icon: '📊',
    description: 'Converts raw usage numbers into a plain-language readout.',
    model: 'gemini-2.0-flash',
    systemPrompt: 'You explain usage metrics in plain language. Always show the calculation.',
    toolIds: ['calculator'],
    status: 'active',
    createdAt: at(400),
    updatedAt: at(72),
  },
  {
    id: 'agent_drafter',
    name: 'Release Notes Drafter (internal review copy)',
    icon: '✍️',
    description:
      'Turns a list of merged pull requests into release notes written for customers rather than for engineers, grouped by the part of the product each change affects.',
    model: 'gemini-2.5-flash',
    systemPrompt: '',
    toolIds: [],
    status: 'draft',
    createdAt: at(200),
    updatedAt: at(120),
  },
];
