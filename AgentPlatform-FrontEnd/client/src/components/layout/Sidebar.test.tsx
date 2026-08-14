import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Sidebar } from './Sidebar';
import type { Agent } from '../../types/agent';

vi.mock('../../hooks/useApiHealth', () => ({ useApiHealth: () => 'online' }));

const agent = (id: string, name: string, icon: string): Agent => ({
  id,
  name,
  icon,
  description: '',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: '',
  toolIds: [],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
});

const agents = [
  agent('agent_support', 'Support Bot', '🎧'),
  agent('agent_research', 'Research Assistant', '🔭'),
];

const renderSidebar = (props: Partial<Parameters<typeof Sidebar>[0]> = {}) =>
  render(
    <MemoryRouter initialEntries={['/agents']}>
      <Sidebar agents={agents} open onClose={() => {}} onSearch={() => {}} searchQuery="" {...props} />
    </MemoryRouter>,
  );

describe('Sidebar', () => {
  it('offers both surfaces as navigation', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /Agents/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Chat/ })).toBeInTheDocument();
  });

  it('marks the current surface for assistive tech', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /^Agents/ })).toHaveAttribute('aria-current', 'page');
  });

  it('hides the nested agents until Agents is expanded', async () => {
    renderSidebar();
    expect(screen.queryByRole('link', { name: /Support Bot/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Expand agents' }));
    expect(screen.getByRole('link', { name: /Support Bot/ })).toHaveAttribute(
      'href',
      '/agents/agent_support',
    );
  });

  it('reports the disclosure state', async () => {
    renderSidebar();
    const toggle = screen.getByRole('button', { name: 'Expand agents' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Collapse agents' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('reports each keystroke in search', async () => {
    const onSearch = vi.fn();
    renderSidebar({ onSearch });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search agents' }), 'sup');
    expect(onSearch).toHaveBeenCalledTimes(3);
  });

  it('reads the API status as text, not colour alone', () => {
    renderSidebar();
    expect(screen.getByText(/connected|api offline|checking/)).toBeInTheDocument();
  });
});
