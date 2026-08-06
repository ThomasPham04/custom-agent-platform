import { TraceRail } from '../trace-rail';
import { formatDuration } from '../../../lib/format';
import type { Agent } from '../../../types/agent';
import type { Message } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './message-turn.css';

interface MessageTurnProps {
  message: Message;
  agent: Agent;
  tools: readonly Tool[];
  onRetry: (messageId: string) => void;
}

export const MessageTurn = ({ message, agent, tools, onRetry }: MessageTurnProps) => {
  if (message.role === 'user') {
    return (
      <article className="turn turn--user">
        <span className="turn__avatar turn__avatar--user" aria-hidden="true">
          ▢
        </span>
        <div className="turn__body">
          <p className="turn__callout">{message.content}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="turn turn--assistant">
      <span className="turn__avatar" aria-hidden="true">
        {agent.icon}
      </span>
      <div className="turn__body">
        <TraceRail
          toolCalls={message.toolCalls ?? []}
          tools={tools}
          running={message.status === 'thinking'}
        />

        {message.status === 'thinking' ? (
          <p className="turn__working mono">working…</p>
        ) : (
          <div
            className={['turn__answer', message.status === 'error' ? 'turn__answer--error' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <p>{message.content}</p>
            {message.status === 'error' && (
              <button
                type="button"
                className="turn__retry"
                onClick={() => onRetry(message.id)}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {message.status === 'done' && message.latencyMs !== undefined && (
          <p className="turn__meta mono">
            {message.model} · {formatDuration(message.latencyMs)}
          </p>
        )}
      </div>
    </article>
  );
};
