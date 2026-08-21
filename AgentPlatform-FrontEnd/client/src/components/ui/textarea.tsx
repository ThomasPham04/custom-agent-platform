import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import './textarea.css';

interface AutoTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  mono?: boolean;
  minRows?: number;
  maxHeight?: number;
  fixed?: boolean;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  /** Marks the control mandatory for assistive tech; the visible * is the caller's. */
  required?: boolean;
  invalid?: boolean;
  /** Id of the element describing why the value is rejected. */
  describedBy?: string;
  id?: string;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const AutoTextarea = ({
  label,
  value,
  onChange,
  hideLabel,
  mono,
  minRows = 1,
  maxHeight = 200,
  fixed = false,
  maxLength,
  placeholder,
  disabled,
  required,
  invalid,
  describedBy,
  id,
  onBlur,
  onKeyDown,
}: AutoTextareaProps) => {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const ref = useRef<HTMLTextAreaElement>(null);

  // Recalculate on every value change, so programmatic writes grow the field too.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (fixed) {
      element.style.height = '';
      element.style.overflowY = 'auto';
      return;
    }
    element.style.height = 'auto';
    const needed = element.scrollHeight;
    element.style.height = `${Math.min(needed, maxHeight)}px`;
    // Only scroll once the content actually exceeds the cap; otherwise `auto`
    // reserves a scrollbar gutter and an empty composer looks broken.
    element.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
  }, [value, maxHeight, fixed]);

  return (
    <div className="textarea">
      <label className={hideLabel ? 'sr-only' : 'textarea__label'} htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        className={['textarea__control', mono ? 'mono' : ''].filter(Boolean).join(' ')}
        value={value}
        rows={minRows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) =>
          onChange(maxLength === undefined ? event.target.value : event.target.value.slice(0, maxLength))
        }
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={fixed ? undefined : { maxHeight: `${maxHeight}px` }}
      />
    </div>
  );
};
