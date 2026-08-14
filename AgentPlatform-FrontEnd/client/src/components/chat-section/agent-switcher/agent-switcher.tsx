import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '../../ui/popover';
import { Chevron } from '../../ui/chevron';
import type { Agent } from '../../../types/agent';
import './agent-switcher.css';

interface AgentSwitcherProps {
  agents: readonly Agent[];
  selected: Agent | null;
  onSelect: (id: string) => void;
}

export const AgentSwitcher = ({ agents, selected, onSelect }: AgentSwitcherProps) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(needle));
  }, [agents, query]);

  useEffect(() => {
    if (activeAgentId && matches.some((agent) => agent.id === activeAgentId)) return;
    setActiveAgentId(matches[0]?.id ?? null);
  }, [activeAgentId, matches]);

  const openSwitcher = () => {
    setQuery('');
    setActiveAgentId(selected?.id ?? agents[0]?.id ?? null);
    setOpen(true);
  };

  const selectAgent = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
    anchor.current?.focus();
  };

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
    <>
      <button ref={anchor} type="button" className="agent-switcher" onClick={openSwitcher}>
        <span className="agent-switcher__icon" aria-hidden="true">
          {selected?.icon ?? '▤'}
        </span>
        <span className="agent-switcher__name">{selected?.name ?? 'Pick an agent'}</span>
        <span className="agent-switcher__chevron">
          <Chevron />
        </span>
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        label="Choose an agent"
        width={280}
        initialFocus={activeOptionRef}
      >
        <div
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            move(event.key === 'ArrowDown' ? 1 : -1);
          }}
        >
          <input
            type="search"
            className="agent-switcher__search"
            aria-label="Search agents"
            placeholder="Search agents…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="agent-switcher__list">
            {matches.map((agent) => (
              <li key={agent.id}>
                <button
                  ref={(node) => {
                    if (node) optionRefs.current.set(agent.id, node);
                    else optionRefs.current.delete(agent.id);
                    if (agent.id === activeAgentId) activeOptionRef.current = node;
                  }}
                  type="button"
                  className="popover__item"
                  aria-pressed={agent.id === selected?.id}
                  tabIndex={agent.id === activeAgentId ? 0 : -1}
                  onClick={() => selectAgent(agent.id)}
                >
                  <span aria-hidden="true">{agent.icon}</span>
                  <span className="agent-switcher__item-name">{agent.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {matches.length === 0 && <p className="popover__note">No agents match that search.</p>}
        </div>
      </Popover>
    </>
  );
};
