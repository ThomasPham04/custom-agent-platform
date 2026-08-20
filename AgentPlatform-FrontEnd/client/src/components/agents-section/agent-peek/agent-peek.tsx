import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AgentForm } from '../agent-form/agent-form';
import { AgentTriggers } from '../agent-triggers/agent-triggers';
import { DraftAgentTriggers } from '../agent-triggers/draft-agent-triggers';
import { ConfirmDelete } from '../../ui/confirm-delete';
import { Popover } from '../../ui/popover';
import { AGENT_ICONS } from '../../../lib/agent-icons';
import { BREAKPOINT_SHEET, useMediaQuery } from '../../../hooks/useMediaQuery';
import { useModalFocus } from '../../../hooks/useModalFocus';
import type { Agent, AgentPatch } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import type { TriggerDraft } from '../../../types/trigger';
import './agent-peek.css';

interface AgentPeekProps {
  agent: Agent;
  tools: readonly Tool[];
  onChange: (patch: AgentPatch) => void;
  dirty?: boolean;
  saveError?: string;
  onSave?: () => void;
  onDelete: () => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  focusName?: boolean;
  onNameFocused?: () => void;
  operationError?: string;
  onRetryOperation?: () => void;
  /**
   * A draft exists only in this panel. It has no history to date, nothing on
   * the server to delete, and no autosave — so it commits through Save instead.
   */
  mode?: 'saved' | 'draft';
  onSaveDraft?: () => void;
  draftTriggers?: readonly TriggerDraft[];
  onDraftTriggersChange?: (drafts: TriggerDraft[]) => void;
  saving?: boolean;
}

const OperationReadout = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <p className="agent-peek__save agent-peek__save--error" role="alert">
    <span className="mono">{message}</span>
    <button
      type="button"
      className="agent-peek__retry"
      aria-label="Retry delete"
      onClick={onRetry}
    >
      Retry
    </button>
  </p>
);

export const AgentPeek = ({
  agent,
  tools,
  onChange,
  dirty = false,
  saveError,
  onSave,
  onDelete,
  onClose,
  returnFocusRef,
  focusName = false,
  onNameFocused,
  operationError,
  onRetryOperation,
  mode = 'saved',
  onSaveDraft,
  draftTriggers = [],
  onDraftTriggersChange = () => {},
  saving = false,
}: AgentPeekProps) => {
  const isDraft = mode === 'draft';
  const panelRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSheet = useMediaQuery(BREAKPOINT_SHEET);

  useModalFocus({
    active: isSheet,
    containerRef: panelRef,
    returnFocusRef,
    isolateOutside: true,
  });

  useLayoutEffect(() => {
    if (!focusName) return;
    const name = nameRef.current;
    if (!name) return;
    name.focus();
    name.select();
    onNameFocused?.();
  }, [agent.id, focusName, onNameFocused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className={['agent-peek', isSheet ? 'agent-peek--sheet' : ''].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal={isSheet ? 'true' : 'false'}
      aria-label={`Agent ${agent.name}`}
      data-walkthrough="agent-panel"
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
                  setIconOpen(false);
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </Popover>

        <input
          ref={nameRef}
          type="text"
          className="agent-peek__name"
          aria-label="Agent name"
          data-walkthrough="agent-name"
          value={agent.name}
          onChange={(event) => onChange({ name: event.target.value })}
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
        <AgentForm
          agent={agent}
          tools={tools}
          onChange={onChange}
          showTimestamps={!isDraft}
          triggerField={
            isDraft ? (
              <DraftAgentTriggers
                drafts={draftTriggers}
                disabled={saving}
                onChange={onDraftTriggersChange}
              />
            ) : (
              <AgentTriggers agentId={agent.id} />
            )
          }
        />

      </div>

      <div className="agent-peek__footer">
        {isDraft ? (
          <div className="agent-peek__commit">
            {operationError && (
              <p className="agent-peek__save agent-peek__save--error" role="alert">
                <span className="mono">{operationError}</span>
              </p>
            )}
            <div className="agent-peek__commit-actions">
              <button type="button" className="button button--sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary button--sm"
                disabled={saving}
                onClick={onSaveDraft}
                data-walkthrough="agent-save"
              >
                {saving ? 'Saving…' : 'Save agent'}
              </button>
            </div>
          </div>
        ) : (
          <div className="agent-peek__commit">
            {saveError && (
              <p className="agent-peek__save agent-peek__save--error" role="alert">
                <span className="mono">Couldn&rsquo;t save. {saveError}</span>
              </p>
            )}
            {operationError && onRetryOperation && (
              <OperationReadout message={operationError} onRetry={onRetryOperation} />
            )}
            <div className="agent-peek__commit-actions agent-peek__commit-actions--saved">
              {/*
                A plain button, not <Button>: the confirm popover anchors to this
                element and Button does not forward a ref. Same classes, same look.
              */}
              <button
                ref={deleteRef}
                type="button"
                className="button button--danger button--sm agent-peek__delete"
                disabled={saving}
                onClick={() => setConfirmOpen(true)}
              >
                Delete agent
              </button>
              <button
                type="button"
                className="button button--primary button--sm"
                disabled={!dirty || saving}
                onClick={onSave}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {!isDraft && (
        <ConfirmDelete
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={onDelete}
          anchor={deleteRef}
          itemName={agent.name}
        />
      )}
    </div>
  );
};
