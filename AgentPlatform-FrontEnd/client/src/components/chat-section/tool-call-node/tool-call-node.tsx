import { useId, useState } from 'react';
import { formatDuration, formatJson } from '../../../lib/format';
import { toolLabel } from '../../../hooks/useTools';
import type { ToolCall } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './tool-call-node.css';

interface ToolCallNodeProps {
  call: ToolCall;
  tools: readonly Tool[];
}

export const ToolCallNode = ({ call, tools }: ToolCallNodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const label = toolLabel(tools, call.toolId);

  // The accessible name carries the state, so colour is never the only signal.
  const accessibleName =
    call.status === 'error'
      ? `${label} failed`
      : call.status === 'running'
        ? `${label}, working`
        : `${label}, ${formatDuration(call.durationMs)}`;

  return (
    <div className={`tool-call tool-call--${call.status}`}>
      <button
        type="button"
        className="tool-call__header"
        aria-expanded={expanded}
        aria-controls={bodyId}
        aria-label={accessibleName}
        onClick={() => setExpanded((open) => !open)}
      >
        <span
          className={['tool-call__triangle', expanded ? 'tool-call__triangle--open' : '']
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          ▸
        </span>
        <span className="tool-call__glyph" aria-hidden="true" />
        <span className="tool-call__label mono">{label}</span>
        <span className="tool-call__id mono">{call.toolId}</span>
        <span className="tool-call__duration mono">
          {call.status === 'running' ? 'working…' : formatDuration(call.durationMs)}
        </span>
      </button>

      <div id={bodyId} className="tool-call__body" hidden={!expanded}>
        <p className="tool-call__caption mono">Arguments</p>
        <pre className="tool-call__code mono">{formatJson(call.args)}</pre>

        {call.status === 'error' ? (
          <>
            <p className="tool-call__caption mono">Error</p>
            <pre className="tool-call__code tool-call__code--error mono">{call.error}</pre>
          </>
        ) : (
          call.status === 'ok' && (
            <>
              <p className="tool-call__caption mono">Result</p>
              <pre className="tool-call__code mono">{formatJson(call.result)}</pre>
            </>
          )
        )}
      </div>
    </div>
  );
};
