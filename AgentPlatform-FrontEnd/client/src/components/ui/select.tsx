import { useId } from 'react';
import './select.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Hide the label visually when a surrounding property row already shows it. */
  hideLabel?: boolean;
  /** Mono face for machine values such as model ids. */
  mono?: boolean;
  /** Marks the control mandatory for assistive tech; the visible * is the caller's. */
  required?: boolean;
  invalid?: boolean;
  /** Id of the element describing why the value is rejected. */
  describedBy?: string;
  id?: string;
}

export const Select = ({
  label,
  value,
  options,
  onChange,
  hideLabel,
  mono,
  required,
  invalid,
  describedBy,
  id,
}: SelectProps) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="select">
      <label className={hideLabel ? 'sr-only' : 'select__label'} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={['select__control', mono ? 'mono' : ''].filter(Boolean).join(' ')}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
