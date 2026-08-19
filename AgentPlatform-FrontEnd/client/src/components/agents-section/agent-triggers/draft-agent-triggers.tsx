import { useState } from 'react';
import { TriggerForm } from '../../triggers-section/trigger-form/trigger-form';
import { Button } from '../../ui/button';
import { newTriggerDraft, scheduleLabel } from '../../../lib/trigger-schedule';
import type { TriggerDraft, TriggerPatch } from '../../../types/trigger';
import './agent-triggers.css';

interface DraftAgentTriggersProps {
  drafts: readonly TriggerDraft[];
  disabled?: boolean;
  onChange: (drafts: TriggerDraft[]) => void;
}

/**
 * Trigger schedules can be composed before an agent has a server id. They stay
 * local with the rest of the new-agent form and are committed by Save agent.
 */
export const DraftAgentTriggers = ({
  drafts,
  disabled = false,
  onChange,
}: DraftAgentTriggersProps) => {
  const [editorIndex, setEditorIndex] = useState<number>();
  const openDraft = editorIndex === undefined ? undefined : drafts[editorIndex];

  const updateAt = (index: number, patch: TriggerPatch) => {
    onChange(drafts.map((draft, current) => (current === index ? { ...draft, ...patch } : draft)));
  };

  return (
    <div className="agent-triggers">
      <div className="agent-triggers__toolbar">
        <span className="agent-triggers__count mono">
          {drafts.length} configured
        </span>
        <button
          type="button"
          className="agent-triggers__add"
          disabled={disabled}
          onClick={() => {
            const nextIndex = drafts.length;
            onChange([...drafts, newTriggerDraft('')]);
            setEditorIndex(nextIndex);
          }}
        >
          Add trigger
        </button>
      </div>

      {drafts.length === 0 && (
        <p className="agent-triggers__empty">No schedules yet.</p>
      )}

      {drafts.length > 0 && (
        <ul className="agent-triggers__list">
          {drafts.map((draft, index) => (
            <li key={index} className="agent-triggers__item">
              <button
                type="button"
                className="agent-triggers__summary"
                disabled={disabled}
                onClick={() => setEditorIndex(index)}
              >
                <span className="agent-triggers__name">{scheduleLabel(draft)}</span>
                <span className="agent-triggers__schedule">
                  {draft.enabled === false ? 'Paused' : 'Enabled'}
                </span>
              </button>
              <label className="agent-triggers__toggle">
                <input
                  type="checkbox"
                  checked={draft.enabled !== false}
                  disabled={disabled}
                  onChange={(event) => updateAt(index, { enabled: event.target.checked })}
                />
                <span className="sr-only">
                  {draft.enabled === false ? 'Enable staged trigger' : 'Disable staged trigger'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {openDraft && editorIndex !== undefined && (
        <section className="agent-triggers__editor" aria-label="Trigger settings">
          <div className="agent-triggers__editor-header">
            <button
              type="button"
              className="agent-triggers__close"
              aria-label="Close trigger settings"
              disabled={disabled}
              onClick={() => setEditorIndex(undefined)}
            >
              ×
            </button>
          </div>

          <TriggerForm
            draft={openDraft}
            disabled={disabled}
            onChange={(patch) => updateAt(editorIndex, patch)}
          />

          <div className="agent-triggers__actions">
            <Button
              size="sm"
              variant="danger"
              disabled={disabled}
              onClick={() => {
                onChange(drafts.filter((_, index) => index !== editorIndex));
                setEditorIndex(undefined);
              }}
            >
              Remove trigger
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
