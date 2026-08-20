import { useRef, useState } from 'react';
import { AgentPicker } from '../../ui/agent-picker';
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button ref={anchor} type="button" className="agent-switcher" data-walkthrough="chat-agent-switcher" onClick={() => setOpen(true)}>
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
        <AgentPicker
          agents={agents}
          selectedId={selected?.id ?? null}
          activeOptionRef={activeOptionRef}
          onSelect={(id) => {
            onSelect(id);
            setOpen(false);
            anchor.current?.focus();
          }}
        />
      </Popover>
    </>
  );
};
