import { useMemo, useRef, useState } from 'react';
import { Popover } from '../../ui/popover';
import type { Agent } from '../../../types/agent';
import './agent-switcher.css';

interface AgentSwitcherProps {
  agents: readonly Agent[];
  selected: Agent | null;
  onSelect: (id: string) => void;
}

export const AgentSwitcher = ({ agents, selected, onSelect }: AgentSwitcherProps) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(needle));
  }, [agents, query]);

  return (
    <>
      <button ref={anchor} type="button" className="agent-switcher" onClick={() => setOpen(true)}>
        <span className="agent-switcher__icon" aria-hidden="true">
          {selected?.icon ?? '▤'}
        </span>
        <span className="agent-switcher__name">{selected?.name ?? 'Pick an agent'}</span>
        <span className="agent-switcher__chevron" aria-hidden="true">
          ⌄
        </span>
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        label="Choose an agent"
        width={280}
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
                type="button"
                className="popover__item"
                aria-pressed={agent.id === selected?.id}
                onClick={() => {
                  onSelect(agent.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span aria-hidden="true">{agent.icon}</span>
                <span className="agent-switcher__item-name">{agent.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 && <p className="popover__note">No agents match that search.</p>}
      </Popover>
    </>
  );
};
