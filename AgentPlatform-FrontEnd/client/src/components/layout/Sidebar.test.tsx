import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Sidebar } from './Sidebar';
import type { Agent } from '../../types/agent';

const health = vi.hoisted(() => ({ current: { status: 'online', mode: 'mock' } }));
vi.mock('../../hooks/useApiHealth', () => ({ useApiHealth: () => health.current }));

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
      <Sidebar agents={agents} open onClose={() => {}} {...props} />
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

  it('leaves searching to the Agents page', () => {
    renderSidebar();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('reads the API status as text, not colour alone', () => {
    renderSidebar();
    expect(screen.getByText(/connected|api offline|checking/)).toBeInTheDocument();
  });

  it('names the mode the API reported rather than a fixed one', () => {
    health.current = { status: 'online', mode: 'live' };
    renderSidebar();
    expect(screen.getByText('connected · live')).toBeInTheDocument();

    health.current = { status: 'online', mode: 'mock' };
  });
});
