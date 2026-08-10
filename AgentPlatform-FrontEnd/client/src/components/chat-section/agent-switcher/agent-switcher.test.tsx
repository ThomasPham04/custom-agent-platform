import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentSwitcher } from './agent-switcher';
import type { Agent } from '../../../types/agent';

const makeAgent = (id: string, name: string): Agent => ({
  id,
  name,
  icon: 'A',
  description: '',
  model: 'gemini-2.5-flash',
  systemPrompt: '',
  toolIds: [],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
});

const agents = [
  makeAgent('agent_support', 'Support Bot'),
  makeAgent('agent_research', 'Research Assistant'),
  makeAgent('agent_metrics', 'Metrics Analyst'),
];

const Harness = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [selectedId, setSelectedId] = useState('agent_research');
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;
  return (
    <AgentSwitcher
      agents={agents}
      selected={selected}
      onSelect={(id) => {
        setSelectedId(id);
        onSelect(id);
      }}
    />
  );
};

describe('AgentSwitcher keyboard behavior', () => {
  it('focuses the selected agent, roves with arrows, and selects with Enter', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const trigger = screen.getByRole('button', { name: /Research Assistant/ });
    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Choose an agent' });
    const selectedOption = within(dialog).getByRole('button', { name: /Research Assistant/ });
    expect(selectedOption).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(dialog).getByRole('button', { name: /Metrics Analyst/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('agent_metrics');
    expect(screen.queryByRole('dialog', { name: 'Choose an agent' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Metrics Analyst/ })).toHaveFocus();
  });

  it('wraps with ArrowUp and selects with Space', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Research Assistant/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose an agent' });
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(within(dialog).getByRole('button', { name: /Metrics Analyst/ })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onSelect).toHaveBeenCalledWith('agent_metrics');
  });
});
