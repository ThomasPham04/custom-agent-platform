import { ToolCallNode } from '../tool-call-node/tool-call-node';
import type { ToolCall } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './trace-rail.css';

interface TraceRailProps {
  toolCalls: readonly ToolCall[];
  tools: readonly Tool[];
  running: boolean;
}

export const TraceRail = ({ toolCalls, tools, running }: TraceRailProps) => {
  // No tools, no rail. The answer stands on its own.
  if (toolCalls.length === 0) return null;

  const failed = toolCalls.some((call) => call.status === 'error');

  return (
    <div className={['trace-rail', running ? 'trace-rail--running' : ''].filter(Boolean).join(' ')}>
      <span
        className={['trace-rail__line', failed ? 'trace-rail__line--failed' : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
      <div className="trace-rail__nodes">
        {toolCalls.map((call) => (
          <ToolCallNode key={call.id} call={call} tools={tools} />
        ))}
      </div>
      {/* The cap marks where machinery ends and the answer begins. */}
      {!running && (
        <span
          className={['trace-rail__cap', failed ? 'trace-rail__cap--failed' : '']
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
