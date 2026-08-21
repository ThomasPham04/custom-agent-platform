/** Keyed by tool id so a prompt actually exercises the tool it belongs to. */
const TOOL_PROMPTS: Record<string, string> = {
  current_time: 'What time is it in Tokyo right now?',
  http_request: 'Is https://google.com responding?',
  calculator: 'What is 184320 divided by 1024, times 0.87?',
  knowledge_search: 'What does our policy say about the refund window?',
};

const GENERIC_PROMPTS = [
  'Introduce yourself in one sentence.',
  'What can you help me with?',
  'Summarise your instructions in three bullets.',
];

/** Always exactly three, tool-derived first, generic filling the remainder. */
export const suggestedPrompts = (toolIds: readonly string[]): string[] => {
  const fromTools = toolIds
    .map((id) => TOOL_PROMPTS[id])
    .filter((prompt): prompt is string => prompt !== undefined);

  const filler = GENERIC_PROMPTS.filter((prompt) => !fromTools.includes(prompt));
  return [...fromTools, ...filler].slice(0, 3);
};
