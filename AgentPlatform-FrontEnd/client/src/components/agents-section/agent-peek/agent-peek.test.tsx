import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentPeek } from './agent-peek';
import type { Agent } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import { MODELS } from '../../../config/models';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: 'Reads the time.', params: [] },
  { id: 'http_request', label: 'HTTP request', description: 'Fetches a URL.', params: [] },
];

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Be terse.',
  toolIds: ['current_time'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const defaults = {
  agent,
  tools,
  saveState: { kind: 'idle' } as const,
  onChange: () => {},
  onFlush: () => {},
  onRetrySave: () => {},
  onDelete: () => {},
  onClose: () => {},
};

afterEach(() => vi.unstubAllGlobals());

describe('AgentPeek', () => {
  it('is a non-modal dialog on a wide viewport so the table stays usable', () => {
    render(<AgentPeek {...defaults} />);
    expect(screen.getByRole('dialog', { name: /Support Bot/ })).toHaveAttribute(
      'aria-modal',
      'false',
    );
  });

  it('edits the name through a plain input, with no Save button anywhere', async () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);

    const nameInput = screen.getByRole('textbox', { name: 'Agent name' });
    expect(nameInput).toHaveValue('Support Bot');

    await userEvent.type(nameInput, '!');
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Support Bot!' });
    expect(screen.queryByRole('button', { name: /^Save$/ })).not.toBeInTheDocument();
  });

  it('focuses and selects the name when opened with creation intent', () => {
    render(<AgentPeek {...defaults} focusName />);
    const name = screen.getByRole('textbox', { name: 'Agent name' });
    expect(name).toHaveFocus();
    expect(name).toHaveProperty('selectionStart', 0);
    expect(name).toHaveProperty('selectionEnd', agent.name.length);
  });

  it('flushes pending edits when a field loses focus', async () => {
    const onFlush = vi.fn();
    render(<AgentPeek {...defaults} onFlush={onFlush} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Agent name' }));
    await userEvent.tab();
    expect(onFlush).toHaveBeenCalled();
  });

  it('sets the system prompt in the mono face', () => {
    render(<AgentPeek {...defaults} />);
    expect(screen.getByRole('textbox', { name: 'System prompt' }).className).toContain('mono');
  });

  it('shows the attached tools as removable chips', async () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Current time' }));
    expect(onChange).toHaveBeenCalledWith({ toolIds: [] });
  });

  it('reads the save state as a timestamp', () => {
    render(
      <AgentPeek {...defaults} saveState={{ kind: 'saved', at: '2026-08-04T21:04:12.000Z' }} />,
    );
    expect(screen.getByText(/^Saved \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('offers a retry when a save failed, and says what happened', async () => {
    const onRetrySave = vi.fn();
    render(
      <AgentPeek
        {...defaults}
        saveState={{ kind: 'error', message: 'Unknown model "gpt-4".' }}
        onRetrySave={onRetrySave}
      />,
    );
    expect(screen.getByText(/Couldn’t save/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetrySave).toHaveBeenCalledOnce();
  });

  it('keeps a failed delete and its operation retry visible inside a mobile peek', async () => {
    const onRetryOperation = vi.fn();
    render(
      <AgentPeek
        {...defaults}
        operationError="Delete failed."
        onRetryOperation={onRetryOperation}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Delete failed.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry delete' }));
    expect(onRetryOperation).toHaveBeenCalledOnce();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<AgentPeek {...defaults} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requires a confirmation before deleting, and names the agent', async () => {
    const onDelete = vi.fn();
    render(<AgentPeek {...defaults} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Support Bot?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('offers the catalog models through a labelled select showing the current one', () => {
    render(<AgentPeek {...defaults} />);
    const select = screen.getByRole('combobox', { name: 'Model' });
    expect(
      Array.from(select.querySelectorAll('option')).map((option) => option.value),
    ).toEqual(MODELS.map((model) => model.id));
    expect(select).toHaveValue(agent.model);
  });

  it('makes the mobile sheet modal, focuses inside, traps outside focus, and restores its opener', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(max-width: 700px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const Harness = () => {
      const [open, setOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);
      return (
        <div>
          <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
            Open agent
          </button>
          {open && (
            <AgentPeek
              {...defaults}
              onClose={() => setOpen(false)}
              returnFocusRef={openerRef}
            />
          )}
        </div>
      );
    };

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open agent' });
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: /Support Bot/ });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(opener).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Change icon' })).toHaveFocus();

    opener.focus();
    await userEvent.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Change icon' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /Support Bot/ })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
