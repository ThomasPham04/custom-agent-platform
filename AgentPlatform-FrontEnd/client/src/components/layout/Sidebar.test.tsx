import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { ToastProvider } from '../ui/toast';
import type { Agent } from '../../types/agent';
import type { Session } from '../../types/session';

const health = vi.hoisted(() => ({ current: { status: 'online', mode: 'mock' } }));
vi.mock('../../hooks/useApiHealth', () => ({ useApiHealth: () => health.current }));

// The sidebar now reads the shared session list, and useSessionsContext throws
// outside a provider. Mocked the same way as useApiHealth so these tests stay
// on the component rather than on the hook, which has its own suite.
const sessionsApi = vi.hoisted(() => ({
  current: {
    sessions: [] as Session[],
    loading: false,
    rename: vi.fn(),
    remove: vi.fn(),
    adopt: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock('../../hooks/useSessions', () => ({ useSessionsContext: () => sessionsApi.current }));

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

const session = (id: string, title: string, agentId = 'agent_support'): Session => ({
  id,
  agentId,
  title,
  createdAt: '2026-08-16T09:00:00.000Z',
  updatedAt: '2026-08-16T10:00:00.000Z',
});

type SessionsApi = typeof sessionsApi.current;

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const renderSidebar = (
  props: Partial<Parameters<typeof Sidebar>[0]> = {},
  sessions: Partial<SessionsApi> = {},
  route = '/agents',
) => {
  sessionsApi.current = { ...sessionsApi.current, ...sessions };
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <Sidebar agents={agents} open onClose={() => {}} {...props} />
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  );
};

const at = () => screen.getByTestId('location').textContent;

/*
  Chats are expanded on arrival, so nothing has to be opened to see them. Kept
  as a named no-op so each test still reads as "with the chats showing" rather
  than depending silently on the default.
*/
const withChatsShowing = async () => {};

const openRowMenu = async (title: string) => {
  const trigger = screen.getByRole('button', { name: `Chat options for ${title}` });
  await userEvent.click(trigger);
  return trigger;
};

beforeEach(() => {
  sessionsApi.current = {
    sessions: [],
    loading: false,
    rename: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    adopt: vi.fn(),
    refresh: vi.fn(),
  };
});

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

  // Replaces "hides the nested agents until Agents is expanded": Agents is now a
  // plain link, so there is no disclosure to expand and no agent ever appears here.
  it('lists no agents under Agents, with nothing to expand', async () => {
    renderSidebar();
    expect(screen.queryByRole('button', { name: /agents$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: /^Agents/ }));
    expect(screen.queryByRole('link', { name: /Support Bot/ })).not.toBeInTheDocument();
  });

  /*
    Chats open on arrival: the sidebar's whole job now is to show the history,
    and Agents no longer lists anything, so a collapsed start would leave it
    empty. The disclosure still closes for anyone who wants it quiet.
  */
  it('shows the chats on arrival and closes on request', async () => {
    renderSidebar();
    const toggle = screen.getByRole('button', { name: 'Collapse chats' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Expand chats' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('lists the chats under Chat', async () => {
    renderSidebar({}, { sessions: [session('sess_1', 'Refund question')] });

    await withChatsShowing();
    expect(screen.getByRole('link', { name: /Refund question/ })).toHaveAttribute(
      'href',
      '/chat/sess_1',
    );
  });

  it('says when there are no chats yet', async () => {
    renderSidebar();
    await withChatsShowing();
    expect(screen.getByText('No chats yet')).toBeInTheDocument();
  });

  it('opens a row menu and returns focus to its trigger on Escape', async () => {
    renderSidebar({}, { sessions: [session('sess_1', 'Refund question')] });
    await withChatsShowing();
    const trigger = await openRowMenu('Refund question');

    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('commits a rename on Enter', async () => {
    const rename = vi.fn().mockResolvedValue(undefined);
    renderSidebar({}, { sessions: [session('sess_1', 'Refund question')], rename });
    await withChatsShowing();
    await openRowMenu('Refund question');
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Chat title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Billing{Enter}');
    expect(rename).toHaveBeenCalledWith('sess_1', 'Billing');
  });

  it('cancels a rename on Escape without asking the server', async () => {
    const rename = vi.fn().mockResolvedValue(undefined);
    renderSidebar({}, { sessions: [session('sess_1', 'Refund question')], rename });
    await withChatsShowing();
    await openRowMenu('Refund question');
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Chat title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Billing{Escape}');

    expect(rename).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Refund question/ })).toBeInTheDocument();
  });

  it('deletes a chat only after the confirmation', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    renderSidebar({}, { sessions: [session('sess_1', 'Refund question')], remove });
    await withChatsShowing();
    await openRowMenu('Refund question');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Refund question?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith('sess_1');
  });

  /*
    Deleting the chat you are reading has to take you off it. The route would
    otherwise stay parked on a session the server no longer has: the header
    loses its title and menu, but the thread keeps rendering and the composer
    would post the next message against a deleted session.
  */
  it('leaves a deleted chat that is the one on screen', async () => {
    renderSidebar({}, { sessions: [session('sess_1', 'Refunds')] }, '/chat/sess_1');
    await withChatsShowing();
    await openRowMenu('Refunds');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(sessionsApi.current.remove).toHaveBeenCalledWith('sess_1'));
    await waitFor(() => expect(at()).toBe('/chat'));
  });

  it('stays put when the deleted chat is not the one on screen', async () => {
    renderSidebar({}, { sessions: [session('sess_1', 'Refunds')] }, '/chat/sess_other');
    await withChatsShowing();
    await openRowMenu('Refunds');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(sessionsApi.current.remove).toHaveBeenCalledWith('sess_1'));
    expect(at()).toBe('/chat/sess_other');
  });

  // A delete that the server refused leaves the chat in place, so moving the
  // user off it would strand them away from a conversation that still exists.
  it('does not move the user when the delete fails', async () => {
    renderSidebar(
      {},
      {
        sessions: [session('sess_1', 'Refunds')],
        remove: vi.fn().mockRejectedValue(new Error('Could not delete the chat.')),
      },
      '/chat/sess_1',
    );
    await withChatsShowing();
    await openRowMenu('Refunds');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(sessionsApi.current.remove).toHaveBeenCalledWith('sess_1'));
    expect(at()).toBe('/chat/sess_1');
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
