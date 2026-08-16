import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageList } from './message-list';
import type { Agent } from '../../../types/agent';
import type { Message } from '../../../types/message';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [{ id: 'current_time', label: 'Current time', description: '', params: [] }];

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: '',
  toolIds: ['current_time'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const defaults = {
  agent,
  agents: [agent],
  tools,
  onRetry: () => {},
  onPickPrompt: () => {},
};

const user: Message = {
  id: 'msg_u',
  role: 'user',
  content: 'what time is it in Tokyo?',
  status: 'done',
  createdAt: '2026-08-04T12:00:00.000Z',
};

describe('MessageList empty states', () => {
  it('introduces the agent and offers tool-derived prompts', () => {
    render(<MessageList {...defaults} messages={[]} />);
    expect(screen.getByText('Support Bot')).toBeInTheDocument();
    expect(screen.getByText('Answers billing questions.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'What time is it in Tokyo right now?' }),
    ).toBeInTheDocument();
  });

  it('fills the composer from a suggested prompt', async () => {
    const onPickPrompt = vi.fn();
    render(<MessageList {...defaults} messages={[]} onPickPrompt={onPickPrompt} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'What time is it in Tokyo right now?' }),
    );
    expect(onPickPrompt).toHaveBeenCalledWith('What time is it in Tokyo right now?');
  });

  it('points at Agents when there is nothing to test', () => {
    render(
      <MessageList
        {...defaults}
        agent={null}
        agents={[]}
        messages={[]}
        onGoToAgents={() => {}}
      />,
    );
    expect(screen.getByText('No agents to test.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Agents' })).toBeInTheDocument();
  });
});

describe('MessageList turns', () => {
  it('renders both roles in document flow', () => {
    const assistant: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: "It's 9:03 PM in Tokyo.",
      toolCalls: [
        {
          id: 'call_1',
          toolId: 'current_time',
          args: {},
          result: '21:03',
          durationMs: 118,
          status: 'ok',
        },
      ],
      model: 'gemini-3.1-flash-lite',
      latencyMs: 298,
      status: 'done',
      createdAt: '2026-08-04T12:00:01.000Z',
    };

    render(<MessageList {...defaults} messages={[user, assistant]} />);
    expect(screen.getByText('what time is it in Tokyo?')).toBeInTheDocument();
    expect(screen.getByText("It's 9:03 PM in Tokyo.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Current time/ })).toBeInTheDocument();
  });

  it('shows a working line while thinking, and no answer yet', () => {
    const thinking: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: '',
      toolCalls: [],
      status: 'thinking',
      createdAt: '2026-08-04T12:00:01.000Z',
    };
    render(<MessageList {...defaults} messages={[user, thinking]} />);
    expect(screen.getByText('working…')).toBeInTheDocument();
  });

  it('offers a retry on a failed turn and states what happened', async () => {
    const onRetry = vi.fn();
    const failed: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: 'http_request failed: connection refused after 800ms.',
      toolCalls: [
        {
          id: 'call_1',
          toolId: 'current_time',
          args: {},
          error: 'connection refused',
          durationMs: 812,
          status: 'error',
        },
      ],
      status: 'error',
      createdAt: '2026-08-04T12:00:01.000Z',
    };

    render(<MessageList {...defaults} messages={[user, failed]} onRetry={onRetry} />);
    // Scoped to the paragraph: the wrapping div holds the Retry button and so
    // matches the same text.
    expect(
      screen.getByText(/connection refused after 800ms/, { selector: 'p' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith('msg_a');
  });

  it('binds each historical Retry button to its own failed turn', async () => {
    const onRetry = vi.fn();
    const firstFailed: Message = {
      id: 'failed_first',
      role: 'assistant',
      content: 'first failed',
      status: 'error',
      createdAt: '2026-08-04T12:00:01.000Z',
    };
    const secondUser = { ...user, id: 'msg_u_2', content: 'second question' };
    const secondFailed = {
      ...firstFailed,
      id: 'failed_second',
      content: 'second failed',
    };

    render(
      <MessageList
        {...defaults}
        messages={[user, firstFailed, secondUser, secondFailed]}
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]!);

    expect(onRetry).toHaveBeenCalledWith('failed_first');
  });

  it('announces the outcome in a polite live region', () => {
    const done: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: 'Done.',
      toolCalls: [],
      status: 'done',
      createdAt: '2026-08-04T12:00:01.000Z',
    };
    render(<MessageList {...defaults} messages={[user, done]} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Support Bot responded');
  });
});

describe('MessageList history loading', () => {
  it('holds the intro back while history is loading', () => {
    render(<MessageList {...defaults} messages={[]} loading />);
    expect(screen.queryByText('Support Bot')).not.toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading conversation' }),
    ).toBeInTheDocument();
  });

  it('shows the intro once loading finishes with no history', () => {
    render(<MessageList {...defaults} messages={[]} loading={false} />);
    expect(screen.getByText('Support Bot')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading conversation' })).not.toBeInTheDocument();
  });

  it('does not announce loading once turns have arrived', () => {
    render(<MessageList {...defaults} messages={[user]} loading />);
    expect(screen.queryByRole('status', { name: 'Loading conversation' })).not.toBeInTheDocument();
    expect(screen.getByText('what time is it in Tokyo?')).toBeInTheDocument();
  });
});
