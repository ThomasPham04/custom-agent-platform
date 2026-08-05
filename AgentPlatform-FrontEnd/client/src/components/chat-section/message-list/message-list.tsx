import { useEffect, useRef } from 'react';
import { MessageTurn } from '../message-turn/message-turn';
import { Chip } from '../../ui/chip';
import { EmptyState } from '../../ui/empty-state';
import { suggestedPrompts } from '../../../data/suggested-prompts';
import { toolLabel } from '../../../hooks/useTools';
import type { Agent } from '../../../types/agent';
import type { Message } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './message-list.css';

interface MessageListProps {
  messages: readonly Message[];
  agent: Agent | null;
  agents: readonly Agent[];
  tools: readonly Tool[];
  onRetry: () => void;
  onPickPrompt: (prompt: string) => void;
  onGoToAgents?: () => void;
}

const announcementFor = (messages: readonly Message[], agent: Agent | null): string => {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant' || !agent) return '';
  if (last.status === 'done') return `${agent.name} responded`;
  if (last.status === 'error') return last.content;
  return '';
};

export const MessageList = ({
  messages,
  agent,
  agents,
  tools,
  onRetry,
  onPickPrompt,
  onGoToAgents,
}: MessageListProps) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <div className="message-list">
      <div className="message-list__live sr-only" role="status" aria-live="polite">
        {announcementFor(messages, agent)}
      </div>

      {messages.length === 0 && agents.length === 0 && (
        <EmptyState
          icon="▤"
          title="No agents to test."
          body="Create an agent to start a test run."
          action={onGoToAgents ? { label: 'Go to Agents', onClick: onGoToAgents } : undefined}
        />
      )}

      {messages.length === 0 && agent && (
        <div className="message-list__intro">
          <span className="message-list__intro-icon" aria-hidden="true">
            {agent.icon}
          </span>
          <p className="message-list__intro-name">{agent.name}</p>
          {agent.description && <p className="message-list__intro-body">{agent.description}</p>}

          {agent.toolIds.length > 0 && (
            <div className="message-list__intro-tools">
              {agent.toolIds.map((toolId) => (
                <Chip key={toolId} tone="trace">
                  {toolLabel(tools, toolId)}
                </Chip>
              ))}
            </div>
          )}

          <ul className="message-list__prompts">
            {suggestedPrompts(agent.toolIds).map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  className="message-list__prompt"
                  onClick={() => onPickPrompt(prompt)}
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {agent &&
        messages.map((message) => (
          <MessageTurn
            key={message.id}
            message={message}
            agent={agent}
            tools={tools}
            onRetry={onRetry}
          />
        ))}

      <div ref={endRef} />
    </div>
  );
};
