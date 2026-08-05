import type { ReactNode } from 'react';
import './chip.css';

export type ChipTone = 'neutral' | 'trace' | 'ok' | 'draft';

interface ChipProps {
  tone?: ChipTone;
  mono?: boolean;
  onRemove?: () => void;
  /** Required whenever onRemove is set: the control needs a specific name. */
  removeLabel?: string;
  children: ReactNode;
}

export const Chip = ({
  tone = 'neutral',
  mono = true,
  onRemove,
  removeLabel,
  children,
}: ChipProps) => (
  <span className={['chip', `chip--${tone}`, mono ? 'mono' : ''].filter(Boolean).join(' ')}>
    {children}
    {onRemove && (
      <button type="button" className="chip__remove" onClick={onRemove} aria-label={removeLabel}>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">
          <path
            d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
        </svg>
      </button>
    )}
  </span>
);
