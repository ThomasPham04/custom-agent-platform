export interface ModelOption {
  id: string;
  label: string;
}

/** Gemini only: the brief prefers Google ADK as the agent framework. */
export const MODELS: readonly ModelOption[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

export const DEFAULT_MODEL = 'gemini-2.5-flash';

export const modelLabel = (id: string): string =>
  MODELS.find((model) => model.id === id)?.label ?? id;
