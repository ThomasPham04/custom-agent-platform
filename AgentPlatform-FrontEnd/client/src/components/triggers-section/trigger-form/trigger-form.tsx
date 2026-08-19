import type { TriggerDraft, TriggerKind, TriggerPatch } from '../../../types/trigger';
import { timezoneOptions } from '../../../lib/trigger-schedule';
import './trigger-form.css';

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
  const toggleDay = (day: number, checked: boolean) => {
    const current = draft.weekdays ?? [];
    onChange({
      weekdays: checked ? [...current, day].sort((a, b) => a - b) : current.filter((d) => d !== day),
    });
  };

  return (
    <div className="trigger-form">
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

          <fieldset className="trigger-form__days">
            <legend>Days</legend>
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
