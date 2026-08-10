/**
 * A fixed set rather than a full emoji keyboard, so the table's icon column
 * stays visually coherent.
 */
export const AGENT_ICONS: readonly string[] = [
  '🧩',
  '🎧',
  '🔭',
  '📊',
  '✍️',
  '🧭',
  '🛠️',
  '📮',
  '🧪',
  '🗂️',
  '🔔',
  '🪶',
  '🧱',
  '🛰️',
  '📌',
  '🧵',
  '🔍',
  '📐',
  '🎯',
  '🗝️',
  '🧮',
  '📎',
  '🚦',
  '🫧',
];

/** Deterministic pick, so an agent keeps its icon across reloads. */
export const defaultAgentIcon = (seed: string): string => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 4096;
  return AGENT_ICONS[hash % AGENT_ICONS.length] ?? '🧩';
};
