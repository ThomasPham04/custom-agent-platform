import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentPeek } from './agent-peek';
import type { Agent } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import type { TriggerDraft } from '../../../types/trigger';
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
  onChange: () => {},
  onSave: () => {},
  onDelete: () => {},
  onClose: () => {},
};

/*
  The panel embeds AgentTriggers, which fetches on mount. Left unstubbed it
  renders "Can't reach the server" — a second role="alert" that collides with
  the save-error assertions below. An empty list is the honest default: these
  tests are about the panel, not about schedules.
*/
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('AgentPeek', () => {
  it('is a non-modal dialog on a wide viewport so the table stays usable', () => {
    render(<AgentPeek {...defaults} />);
    expect(screen.getByRole('dialog', { name: /Support Bot/ })).toHaveAttribute(
      'aria-modal',
      'false',
    );
  });

  it('edits the name through a plain input', async () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);

    const nameInput = screen.getByRole('textbox', { name: 'Agent name' });
    expect(nameInput).toHaveValue('Support Bot');

    await userEvent.type(nameInput, '!');
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Support Bot!' });
  });

  it('focuses and selects the name when opened with creation intent', () => {
    render(<AgentPeek {...defaults} focusName />);
    const name = screen.getByRole('textbox', { name: 'Agent name' });
    expect(name).toHaveFocus();
    expect(name).toHaveProperty('selectionStart', 0);
    expect(name).toHaveProperty('selectionEnd', agent.name.length);
  });

  it('sets the system prompt in the mono face', () => {
    render(<AgentPeek {...defaults} />);
    expect(screen.getByRole('textbox', { name: 'System prompt' }).className).toContain('mono');
  });

  it('keeps the system prompt fixed at eight rows and limits it to 500 characters', () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);
    const prompt = screen.getByRole('textbox', { name: 'System prompt' });

    expect(prompt).toHaveAttribute('rows', '8');
    expect(prompt).toHaveAttribute('maxlength', '500');
    expect(prompt.style.height).toBe('');
    expect(screen.getByText('9/500 characters')).toBeInTheDocument();

    fireEvent.change(prompt, { target: { value: 'x'.repeat(501) } });
    expect(onChange).toHaveBeenCalledWith({ systemPrompt: 'x'.repeat(500) });
  });

  it('shows the attached tools as removable chips', async () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Current time' }));
    expect(onChange).toHaveBeenCalledWith({ toolIds: [] });
  });

  it('keeps Save changes disabled until the parent reports a change', () => {
    const { rerender } = render(<AgentPeek {...defaults} dirty={false} />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    rerender(<AgentPeek {...defaults} dirty />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('places filled Delete and Save actions on the same saved-agent footer row', () => {
    render(<AgentPeek {...defaults} />);
    const save = screen.getByRole('button', { name: 'Save changes' });
    const footer = save.closest('.agent-peek__footer');
    expect(footer).not.toBeNull();

    const deleteButton = within(footer as HTMLElement).getByRole('button', {
      name: 'Delete agent',
    });
    expect(deleteButton).toHaveClass('agent-peek__delete');
    expect(deleteButton).toHaveClass('button--danger');
    expect(within(footer as HTMLElement).getByRole('button', { name: 'Save changes' })).toBe(save);
  });

  it('submits explicit saves and reports in-flight and failed states', async () => {
    const onSave = vi.fn();
    const { rerender } = render(<AgentPeek {...defaults} dirty onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledOnce();

    rerender(<AgentPeek {...defaults} dirty saving onSave={onSave} />);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete agent' })).toBeDisabled();

    rerender(<AgentPeek {...defaults} dirty saveError="Could not save." onSave={onSave} />);
    expect(screen.getByText(/Could not save\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('styles Add with the shared primary action treatment', () => {
    render(<AgentPeek {...defaults} />);
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('button--primary');
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

  it('dates a saved agent so its history is on the panel', () => {
    render(<AgentPeek {...defaults} />);
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
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

describe('AgentPeek in draft mode', () => {
  const draftDefaults = { ...defaults, mode: 'draft' as const, onSaveDraft: () => {} };

  it('offers Save and Cancel, because nothing is written until Save', () => {
    render(<AgentPeek {...draftDefaults} />);
    expect(screen.getByRole('button', { name: 'Save agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('offers no delete, because there is nothing on the server to delete', () => {
    render(<AgentPeek {...draftDefaults} />);
    expect(screen.queryByRole('button', { name: 'Delete agent' })).not.toBeInTheDocument();
  });

  it('shows no Created or Updated, because the draft has no history yet', () => {
    render(<AgentPeek {...draftDefaults} />);
    expect(screen.queryByText('Created')).not.toBeInTheDocument();
    expect(screen.queryByText('Updated')).not.toBeInTheDocument();
  });

  it('shows no autosave readout, because a draft never autosaves', () => {
    render(<AgentPeek {...draftDefaults} />);
    expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
  });

  it('stages trigger schedules before the agent is saved', async () => {
    const DraftHarness = () => {
      const [draftTriggers, setDraftTriggers] = useState<TriggerDraft[]>([]);
      return (
        <AgentPeek
          {...draftDefaults}
          draftTriggers={draftTriggers}
          onDraftTriggersChange={setDraftTriggers}
        />
      );
    };

    render(<DraftHarness />);
    expect(screen.queryByText('Save this agent to add a trigger.')).not.toBeInTheDocument();
    expect(screen.getByText('0 configured')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add trigger' }));
    expect(screen.getByText('1 configured')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Repeats' })).toHaveValue('daily');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Repeats' }), 'interval');
    const minutes = screen.getByRole('spinbutton', { name: 'Every (minutes)' });
    await userEvent.clear(minutes);
    await userEvent.type(minutes, '15');
    await userEvent.click(screen.getByRole('button', { name: 'Close trigger settings' }));

    expect(screen.getByText(/Every 15 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save agent' })).toBeEnabled();
  });

  it('saves the draft on demand', async () => {
    const onSaveDraft = vi.fn();
    render(<AgentPeek {...draftDefaults} onSaveDraft={onSaveDraft} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save agent' }));
    expect(onSaveDraft).toHaveBeenCalledOnce();
  });

  it('discards the draft from Cancel and from Escape', async () => {
    const onClose = vi.fn();
    render(<AgentPeek {...draftDefaults} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('reports a failed save on the panel and keeps the draft open', () => {
    render(<AgentPeek {...draftDefaults} operationError="Could not create the agent." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not create the agent.');
    expect(screen.getByRole('button', { name: 'Save agent' })).toBeInTheDocument();
  });

  it('disables Save while the create is in flight so one click makes one agent', () => {
    render(<AgentPeek {...draftDefaults} saving />);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
