import { useEffect, useRef, useState } from 'react';
import { AgentForm } from '../agent-form/agent-form';
import { ConfirmDelete } from '../../ui/confirm-delete';
import { Popover } from '../../ui/popover';
import { AGENT_ICONS } from '../../../lib/agent-icons';
import { formatClockTime } from '../../../lib/format';
import { BREAKPOINT_SHEET, useMediaQuery } from '../../../hooks/useMediaQuery';
import type { SaveState } from '../../../hooks/useAgents';
import type { Agent, AgentPatch } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import './agent-peek.css';

interface AgentPeekProps {
  agent: Agent;
  tools: readonly Tool[];
  saveState: SaveState;
  onChange: (patch: AgentPatch) => void;
  onFlush: () => void;
  onRetrySave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const SaveReadout = ({
  saveState,
  onRetrySave,
}: {
  saveState: SaveState;
  onRetrySave: () => void;
}) => {
  if (saveState.kind === 'idle') return null;

  if (saveState.kind === 'error') {
    return (
      <p className="agent-peek__save agent-peek__save--error" role="alert">
        <span className="mono">Couldn&rsquo;t save. {saveState.message}</span>
        <button type="button" className="agent-peek__retry" onClick={onRetrySave}>
          Retry
        </button>
      </p>
    );
  }

  return (
    <p className="agent-peek__save mono">
      {saveState.kind === 'saving' ? 'Saving…' : `Saved ${formatClockTime(saveState.at)}`}
    </p>
  );
};

export const AgentPeek = ({
  agent,
  tools,
  saveState,
  onChange,
  onFlush,
  onRetrySave,
  onDelete,
  onClose,
}: AgentPeekProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSheet = useMediaQuery(BREAKPOINT_SHEET);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // As a bottom sheet the table is hidden behind it, so focus must stay inside.
  useEffect(() => {
    if (!isSheet) return;
    const panel = panelRef.current;
    if (!panel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [isSheet]);

  return (
    <div
      ref={panelRef}
      className={['agent-peek', isSheet ? 'agent-peek--sheet' : ''].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal={isSheet ? 'true' : 'false'}
      aria-label={`Agent ${agent.name}`}
    >
      <div className="agent-peek__header">
        <button
          ref={iconRef}
          type="button"
          className="agent-peek__icon"
          aria-label="Change icon"
          onClick={() => setIconOpen(true)}
        >
          {agent.icon}
        </button>

        <Popover
          open={iconOpen}
          onClose={() => setIconOpen(false)}
          anchor={iconRef}
          label="Choose an icon"
          width={248}
        >
          <div className="agent-peek__icon-grid">
            {AGENT_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className="agent-peek__icon-option"
                aria-label={`Use ${icon}`}
                aria-pressed={icon === agent.icon}
                onClick={() => {
                  onChange({ icon });
                  onFlush();
                  setIconOpen(false);
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </Popover>

        <input
          type="text"
          className="agent-peek__name"
          aria-label="Agent name"
          value={agent.name}
          onChange={(event) => onChange({ name: event.target.value })}
          onBlur={onFlush}
        />

        <button
          type="button"
          className="agent-peek__close"
          aria-label="Close panel"
          onClick={onClose}
        >
          <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" focusable="false">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="agent-peek__body">
        <AgentForm agent={agent} tools={tools} onChange={onChange} onFlush={onFlush} />

        <div className="agent-peek__danger">
          {/*
            A plain button, not <Button>: the confirm popover anchors to this
            element and Button does not forward a ref. Same classes, same look.
          */}
          <button
            ref={deleteRef}
            type="button"
            className="button button--danger button--sm"
            onClick={() => setConfirmOpen(true)}
          >
            Delete agent
          </button>
        </div>
      </div>

      <div className="agent-peek__footer">
        <SaveReadout saveState={saveState} onRetrySave={onRetrySave} />
      </div>

      <ConfirmDelete
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onDelete}
        anchor={deleteRef}
        itemName={agent.name}
      />
    </div>
  );
};
