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
  placeholder?: string;
  disabled?: boolean;
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
  placeholder,
  disabled,
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
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

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
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={{ maxHeight: `${maxHeight}px`, overflowY: 'auto' }}
      />
    </div>
  );
};
