import { useId } from 'react';
import type { TriggerDraft, TriggerKind, TriggerPatch } from '../../../types/trigger';
import { timezoneOptions } from '../../../lib/trigger-schedule';
import './trigger-form.css';

/**
 * The same editing budget the agent form gives a system prompt, and for the same
 * reason: a firing message is an instruction, not a document. The server accepts
 * 20,000, so this is a UI limit — raising it needs no API change.
 */
const MESSAGE_MAX_LENGTH = 500;

const DAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

interface TriggerFormProps {
  draft: TriggerDraft;
  disabled?: boolean;
  onChange: (patch: TriggerPatch) => void;
}

export const TriggerForm = ({ draft, disabled = false, onChange }: TriggerFormProps) => {
  const messageId = useId();

  const toggleDay = (day: number, checked: boolean) => {
    const current = draft.weekdays ?? [];
    onChange({
      weekdays: checked ? [...current, day].sort((a, b) => a - b) : current.filter((d) => d !== day),
    });
  };

  return (
    <div className="trigger-form">
      {/* First, because it is the whole content of a firing: the agent receives
          this text verbatim and has no memory of the previous run, so anything
          the task needs — a URL, a threshold — belongs here or in the system
          prompt, not in either one alone. */}
      {/* The counter is a sibling of the label rather than inside it: a label's
          text content becomes the field's accessible name, so nesting it would
          rename the control to "Message 0/500 characters" on every keystroke. */}
      <div className="trigger-form__field">
        <label htmlFor={messageId}>Message</label>
        <textarea
          id={messageId}
          className="trigger-form__message"
          rows={3}
          maxLength={MESSAGE_MAX_LENGTH}
          value={draft.message}
          disabled={disabled}
          placeholder="What to send the agent on every firing."
          onChange={(event) =>
            onChange({ message: event.target.value.slice(0, MESSAGE_MAX_LENGTH) })
          }
        />
        <p className="trigger-form__count mono">
          {draft.message.length}/{MESSAGE_MAX_LENGTH} characters
        </p>
      </div>

      <label className="trigger-form__field">
        <span>Repeats</span>
        <select
          value={draft.kind}
          disabled={disabled}
          onChange={(event) => {
            const kind = event.target.value as TriggerKind;
            onChange(
              kind === 'interval'
                ? { kind, intervalMinutes: draft.intervalMinutes ?? 60 }
                : {
                    kind,
                    timeOfDay: draft.timeOfDay ?? '09:00',
                    weekdays: draft.weekdays ?? [],
                  },
            );
          }}
        >
          <option value="daily">Daily at a time</option>
          <option value="interval">Every so often</option>
        </select>
      </label>

      {draft.kind === 'interval' ? (
        <label className="trigger-form__field">
          <span>Every (minutes)</span>
          <input
            type="number"
            min={1}
            value={draft.intervalMinutes ?? 60}
            disabled={disabled}
            onChange={(event) => onChange({ intervalMinutes: Number(event.target.value) })}
          />
        </label>
      ) : (
        <>
          <label className="trigger-form__field">
            <span>Time</span>
            <input
              type="time"
              value={draft.timeOfDay ?? '09:00'}
              disabled={disabled}
              onChange={(event) => onChange({ timeOfDay: event.target.value })}
            />
          </label>

          {/* A fieldset so the seven boxes share one group name, but the legend
              is styled out of the border and the checkboxes moved into their own
              box, so this row reads like Time and Time zone above it rather than
              like a different species of control. */}
          <fieldset className="trigger-form__days">
            <legend>Days</legend>
            <div className="trigger-form__days-grid">
              {DAYS.map((day) => (
                <label key={day.value} className="trigger-form__day">
                  <input
                    type="checkbox"
                    checked={(draft.weekdays ?? []).includes(day.value)}
                    disabled={disabled}
                    onChange={(event) => toggleDay(day.value, event.target.checked)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
            <p className="trigger-form__hint">Leave every day unchecked to run every day.</p>
          </fieldset>
        </>
      )}

      <label className="trigger-form__field">
        <span>Time zone</span>
        <select
          value={draft.timezone ?? 'UTC'}
          disabled={disabled}
          onChange={(event) => onChange({ timezone: event.target.value })}
        >
          {timezoneOptions(draft.timezone).map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
