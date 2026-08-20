import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentTable } from './agent-table';
import type { Agent } from '../../../types/agent';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: '', params: [] },
  { id: 'http_request', label: 'HTTP request', description: '', params: [] },
  { id: 'calculator', label: 'Calculator', description: '', params: [] },
];

const make = (over: Partial<Agent>): Agent => ({
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: '',
  toolIds: ['current_time', 'http_request'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  ...over,
});

const defaults = {
  tools,
  loading: false,
  selectedId: null,
  onSelect: () => {},
  onTestInChat: () => {},
  onDownloadRunLogs: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
};

describe('AgentTable', () => {
  it('renders a real table with the documented columns', () => {
    render(<AgentTable {...defaults} agents={[make({})]} />);
    const table = screen.getByRole('table', { name: 'Agents' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      'Name',
      'Description',
      'Model',
      'Tools',
      'Status',
      'Updated',
      'Actions',
    ]);
  });

  it('shows at most two tool chips and counts the rest', () => {
    render(
      <AgentTable
        {...defaults}
        agents={[make({ toolIds: ['current_time', 'http_request', 'calculator'] })]}
      />,
    );
    expect(screen.getByText('Current time')).toBeInTheDocument();
    expect(screen.getByText('HTTP request')).toBeInTheDocument();
    expect(screen.queryByText('Calculator')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders an em dash for an agent with no tools', () => {
    render(<AgentTable {...defaults} agents={[make({ toolIds: [], description: 'x' })]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('reports the status as text rather than colour alone', () => {
    render(<AgentTable {...defaults} agents={[make({ status: 'draft' })]} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('selects on click', async () => {
    const onSelect = vi.fn();
    render(<AgentTable {...defaults} agents={[make({})]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('row', { name: /Support Bot/ }));
    expect(onSelect).toHaveBeenCalledWith('agent_support');
  });

  it('selects on Enter from the keyboard', async () => {
    const onSelect = vi.fn();
    render(<AgentTable {...defaults} agents={[make({})]} onSelect={onSelect} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('agent_support');
  });

  it('marks the selected row', () => {
    render(<AgentTable {...defaults} agents={[make({})]} selectedId="agent_support" />);
    expect(screen.getByRole('row', { name: /Support Bot/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('offers row actions without selecting the row', async () => {
    const onSelect = vi.fn();
    const onDuplicate = vi.fn();
    render(
      <AgentTable
        {...defaults}
        agents={[make({})]}
        onSelect={onSelect}
        onDuplicate={onDuplicate}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Support Bot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(onDuplicate).toHaveBeenCalledWith('agent_support');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('opens the actions menu with Enter without selecting the row', async () => {
    const onSelect = vi.fn();
    render(<AgentTable {...defaults} agents={[make({})]} onSelect={onSelect} />);

    const actions = screen.getByRole('button', { name: 'Actions for Support Bot' });
    actions.focus();
    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('dialog', { name: 'Actions for Support Bot' })).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('confirms before deleting from the row menu, since deleting cannot be undone', async () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    render(<AgentTable {...defaults} agents={[make({})]} onDelete={onDelete} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Support Bot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Not deleted yet: the confirmation names the agent first.
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Support Bot?')).toBeInTheDocument();

    const confirm = screen.getByRole('dialog', { name: 'Delete Support Bot' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('agent_support');
    // Confirming must not also open the row.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('uses valid action-cell structure without a span around the confirmation portal', () => {
    render(<AgentTable {...defaults} agents={[make({})]} />);
    const row = screen.getByRole('row', { name: /Support Bot/ });
    const actionCell = within(row).getAllByRole('cell').at(-1);
    expect(actionCell?.querySelector(':scope > span')).toBeNull();
  });

  it('renders skeleton rows while loading and no agent rows', () => {
    render(<AgentTable {...defaults} agents={[]} loading />);
    expect(screen.queryByRole('row', { name: /Support Bot/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4); // header + 3 skeletons
  });
});
