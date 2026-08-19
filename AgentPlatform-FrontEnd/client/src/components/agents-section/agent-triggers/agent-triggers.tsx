import { useEffect, useRef, useState } from 'react';
import { TriggerActivity } from '../../triggers-section/trigger-activity/trigger-activity';
import { TriggerForm } from '../../triggers-section/trigger-form/trigger-form';
import { Button } from '../../ui/button';
import { useTriggers } from '../../../hooks/useTriggers';
import {
  newTriggerDraft,
  scheduleLabel,
  triggerPatch,
  triggerToDraft,
} from '../../../lib/trigger-schedule';
import type { TriggerDraft, TriggerPatch } from '../../../types/trigger';
import './agent-triggers.css';

interface AgentTriggersProps {
  agentId: string;
}

type TriggerEditor =
  | { kind: 'new'; draft: TriggerDraft }
  | { kind: 'edit'; triggerId: string; draft: TriggerDraft };

type PendingAction = { kind: 'save' | 'run' | 'delete'; target: string };

export const AgentTriggers = ({ agentId }: AgentTriggersProps) => {
  const { triggers, loading, error, create, save, toggle, remove, fireNow, refresh } =
    useTriggers(agentId);
  const [editor, setEditor] = useState<TriggerEditor>();
  const [pending, setPending] = useState<PendingAction>();
  const [actionError, setActionError] = useState<string>();
  const [activityToken, setActivityToken] = useState(0);
  const mounted = useRef(true);
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const openTrigger =
    editor?.kind === 'edit'
      ? triggers.find((trigger) => trigger.id === editor.triggerId)
      : undefined;
  const busy = pending !== undefined;

  const changeDraft = (patch: TriggerPatch) => {
    setEditor((current) =>
      current === undefined ? current : { ...current, draft: { ...current.draft, ...patch } },
    );
    setActionError(undefined);
  };

  const saveEditor = async () => {
    const submitted = editor;
    if (!submitted || busy) return;
    const baseline =
      submitted.kind === 'edit'
        ? triggers.find((trigger) => trigger.id === submitted.triggerId)
        : undefined;
    if (submitted.kind === 'edit' && !baseline) {
      setActionError('This trigger no longer exists. Reload the agent and try again.');
      return;
    }
    const patch = baseline ? triggerPatch(baseline, submitted.draft) : undefined;
    if (patch && Object.keys(patch).length === 0) {
      setEditor(undefined);
      return;
    }

    const target = submitted.kind === 'new' ? 'new' : submitted.triggerId;
    setPending({ kind: 'save', target });
    setActionError(undefined);

    const result =
      submitted.kind === 'new'
        ? await create(submitted.draft)
        : await save(submitted.triggerId, patch!);

    if (!mounted.current) return;
    setPending(undefined);
    if (editorRef.current !== submitted) return;
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setEditor(undefined);
  };

  const deleteOpenTrigger = async () => {
    if (!openTrigger || busy) return;
    const target = openTrigger.id;
    setPending({ kind: 'delete', target });
    setActionError(undefined);
    const result = await remove(target);
    if (!mounted.current) return;
    setPending(undefined);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setEditor((current) =>
      current?.kind === 'edit' && current.triggerId === target ? undefined : current,
    );
  };

  return (
    <div className="agent-triggers">
      <div className="agent-triggers__toolbar">
        <span className="agent-triggers__count mono">
          {loading ? 'Loading…' : `${triggers.length} configured`}
        </span>
        <button
          type="button"
          className="agent-triggers__add"
          disabled={busy}
          onClick={() => {
            setEditor({ kind: 'new', draft: newTriggerDraft(agentId) });
            setActionError(undefined);
          }}
        >
          Add trigger
        </button>
      </div>

      {error && (
        <p className="agent-triggers__error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => void refresh().catch(() => undefined)}>
            Retry
          </button>
        </p>
      )}

      {!loading && triggers.length === 0 && !editor && (
        <p className="agent-triggers__empty">No schedules yet.</p>
      )}

      {triggers.length > 0 && (
        <ul className="agent-triggers__list">
          {triggers.map((trigger) => (
            <li key={trigger.id} className="agent-triggers__item">
              <button
                type="button"
                className="agent-triggers__summary"
                disabled={busy}
                onClick={() => {
                  setEditor({
                    kind: 'edit',
                    triggerId: trigger.id,
                    draft: triggerToDraft(trigger),
                  });
                  setActionError(undefined);
                }}
              >
                <span className="agent-triggers__name">{scheduleLabel(trigger)}</span>
                <span className="agent-triggers__schedule">
                  {trigger.enabled ? 'Enabled' : 'Paused'}
                </span>
              </button>
              <label className="agent-triggers__toggle">
                <input
                  type="checkbox"
                  checked={trigger.enabled}
                  disabled={busy}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setActionError(undefined);
                    void toggle(trigger.id, enabled).then((result) => {
                      if (mounted.current && !result.ok) setActionError(result.message);
                    });
                  }}
                />
                <span className="sr-only">
                  {trigger.enabled ? `Disable ${trigger.name}` : `Enable ${trigger.name}`}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <section className="agent-triggers__editor" aria-label="Trigger settings">
          <div className="agent-triggers__editor-header">
            <button
              type="button"
              className="agent-triggers__close"
              aria-label="Close trigger settings"
              disabled={busy}
              onClick={() => {
                setEditor(undefined);
                setActionError(undefined);
              }}
            >
              ×
            </button>
          </div>

          <TriggerForm draft={editor.draft} disabled={busy} onChange={changeDraft} />

          {actionError && (
            <p className="agent-triggers__error" role="alert">
              {actionError}
            </p>
          )}

          <div className="agent-triggers__actions">
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => void saveEditor()}
            >
              {pending?.kind === 'save' ? 'Saving…' : 'Save trigger'}
            </Button>
            {openTrigger && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setPending({ kind: 'run', target: openTrigger.id });
                    setActionError(undefined);
                    void fireNow(openTrigger.id).then((result) => {
                      if (!mounted.current) return;
                      setPending(undefined);
                      if (!result.ok) {
                        setActionError(result.message);
                        return;
                      }
                      setActivityToken((current) => current + 1);
                    });
                  }}
                >
                  {pending?.kind === 'run' ? 'Running…' : 'Run now'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void deleteOpenTrigger()}
                >
                  {pending?.kind === 'delete' ? 'Deleting…' : 'Delete'}
                </Button>
              </>
            )}
          </div>

          {openTrigger && (
            <div className="agent-triggers__activity">
              <h3>Activity</h3>
              <TriggerActivity triggerId={openTrigger.id} refreshToken={activityToken} />
            </div>
          )}
        </section>
      )}

      {!editor && actionError && (
        <p className="agent-triggers__error" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
};
