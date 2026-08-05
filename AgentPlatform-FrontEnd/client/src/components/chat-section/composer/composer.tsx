import { useState } from 'react';
import { AutoTextarea } from '../../ui/textarea';
import './composer.css';

interface ComposerProps {
  agentName: string;
  disabled: boolean;
  onSend: (content: string) => void;
}

export const Composer = ({ agentName, disabled, onSend }: ComposerProps) => {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft('');
  };

  return (
    <div className="composer">
      <div className="composer__field">
        <AutoTextarea
          label={`Message ${agentName}`}
          hideLabel
          value={draft}
          disabled={disabled}
          placeholder={`Message ${agentName}…`}
          maxHeight={200}
          onChange={setDraft}
          onKeyDown={(event) => {
            // Shift+Enter is a newline; Enter alone sends.
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            submit();
          }}
        />
        <button
          type="button"
          className="composer__send"
          aria-label="Send message"
          disabled={!canSend}
          onClick={submit}
        >
          {disabled ? (
            <span className="composer__spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path
                d="M3 8h9M8.5 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="composer__hint mono">Enter to send · Shift+Enter for newline</p>
    </div>
  );
};
