import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Agent } from '../../../types/agent';
import './agent-picker.css';

interface AgentPickerProps {
  agents: readonly Agent[];
  /** Marked as pressed and focused first. Null when nothing is chosen yet. */
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /**
   * Filled with the option the arrows are on, so the popover holding this list
   * can hand it the first focus. The picker only writes to it.
   */
  activeOptionRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * The searchable agent list two surfaces share: the chat header's switcher and
 * the sidebar's new-chat button. It carries no popover of its own, because the
 * two anchor and label theirs differently.
 *
 * Query and roving focus are local state, and every caller mounts this inside a
 * popover that unmounts on close — so each opening starts on the selected agent
 * with an empty search, without a reset the caller has to remember to run.
 */
export const AgentPicker = ({
  agents,
  selectedId = null,
  onSelect,
  activeOptionRef,
}: AgentPickerProps) => {
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [query, setQuery] = useState('');
  const [activeAgentId, setActiveAgentId] = useState<string | null>(
    selectedId ?? agents[0]?.id ?? null,
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(needle));
  }, [agents, query]);

  useEffect(() => {
    if (activeAgentId && matches.some((agent) => agent.id === activeAgentId)) return;
    setActiveAgentId(matches[0]?.id ?? null);
  }, [activeAgentId, matches]);

  const move = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    const currentIndex = Math.max(
      matches.findIndex((agent) => agent.id === activeAgentId),
      0,
    );
    const nextIndex = (currentIndex + direction + matches.length) % matches.length;
    const nextId = matches[nextIndex]?.id;
    if (!nextId) return;
    setActiveAgentId(nextId);
    optionRefs.current.get(nextId)?.focus();
  };

  return (
    <div
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        move(event.key === 'ArrowDown' ? 1 : -1);
      }}
    >
      <input
        type="search"
        className="agent-picker__search"
        aria-label="Search agents"
        placeholder="Search agents…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="agent-picker__list">
        {matches.map((agent) => (
          <li key={agent.id}>
            <button
              ref={(node) => {
                if (node) optionRefs.current.set(agent.id, node);
                else optionRefs.current.delete(agent.id);
                if (activeOptionRef && agent.id === activeAgentId) activeOptionRef.current = node;
              }}
              type="button"
              className="popover__item"
              aria-pressed={agent.id === selectedId}
              tabIndex={agent.id === activeAgentId ? 0 : -1}
              onClick={() => onSelect(agent.id)}
            >
              <span aria-hidden="true">{agent.icon}</span>
              <span className="agent-picker__name">{agent.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {/* An empty workspace and an unmatched search are different problems, and
          "no agents match" would send someone looking for a typo they never made. */}
      {matches.length === 0 && (
        <p className="popover__note">
          {agents.length === 0 ? 'No agents yet.' : 'No agents match that search.'}
        </p>
      )}
    </div>
  );
};
