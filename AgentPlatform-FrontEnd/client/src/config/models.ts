export interface ModelOption {
  id: string;
  label: string;
}

/**
 * Gemini only: the brief prefers Google ADK as the agent framework.
 * Mirrors app/modules/llm/catalog.py — change both together. The earlier
 * 2.x ids were retired by Google and answer 404 on generateContent.
 */
export const MODELS: readonly ModelOption[] = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
];

export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export const modelLabel = (id: string): string =>
  MODELS.find((model) => model.id === id)?.label ?? id;
