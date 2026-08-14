import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageTurn } from './message-turn';
import type { Agent } from '../../../types/agent';
import type { Message } from '../../../types/message';

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: '',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: '',
  toolIds: [],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const assistant = (content: string, overrides: Partial<Message> = {}): Message => ({
  id: 'msg_1',
  role: 'assistant',
  content,
  toolCalls: [],
  status: 'done',
  createdAt: '2026-08-04T10:00:00.000Z',
  ...overrides,
});

const renderTurn = (message: Message) =>
  render(<MessageTurn message={message} agent={agent} tools={[]} onRetry={vi.fn()} />);

describe('MessageTurn markdown', () => {
  it('renders bold spans rather than printing the asterisks', () => {
    renderTurn(assistant('He has won **eight Ballon d’Or awards**.'));

    expect(screen.getByText('eight Ballon d’Or awards').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('renders a markdown list as a real list', () => {
    renderTurn(assistant('* **Club career:** Barcelona\n* **International:** Argentina'));

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Club career: Barcelona');
  });

  it('keeps separate paragraphs separate', () => {
    const { container } = renderTurn(assistant('First paragraph.\n\nSecond paragraph.'));
    expect(container.querySelectorAll('.turn__answer p')).toHaveLength(2);
  });

  it('renders headings and fenced code', () => {
    const { container } = renderTurn(assistant('## Key facts\n\n```\nnpm run dev\n```'));

    expect(screen.getByRole('heading', { name: 'Key facts' })).toBeInTheDocument();
    expect(container.querySelector('.turn__answer pre code')).toHaveTextContent('npm run dev');
  });

  it('does not render raw HTML embedded in the answer', () => {
    const { container } = renderTurn(assistant('<img src=x onerror="alert(1)"> done'));
    expect(container.querySelector('img')).toBeNull();
  });

  it('leaves a failed answer as plain text so the message is not reinterpreted', () => {
    renderTurn(assistant('The model is out of quota right now.', { status: 'error' }));
    expect(screen.getByText('The model is out of quota right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('MessageTurn avatars', () => {
  it('draws the user avatar rather than relying on a font glyph', () => {
    const { container } = render(
      <MessageTurn
        message={{
          id: 'msg_0',
          role: 'user',
          content: 'Who is Messi',
          status: 'done',
          createdAt: '2026-08-04T10:00:00.000Z',
        }}
        agent={agent}
        tools={[]}
        onRetry={vi.fn()}
      />,
    );

    const avatar = container.querySelector('.turn__avatar--user');
    expect(avatar?.querySelector('svg')).not.toBeNull();
    // U+25A2 has no glyph in the UI font and rendered as a notdef box.
    expect(avatar?.textContent).not.toContain('▢');
  });

  it('still shows the agent icon for the assistant', () => {
    renderTurn(assistant('Hello.'));
    expect(screen.getByText('🎧')).toBeInTheDocument();
  });
});
