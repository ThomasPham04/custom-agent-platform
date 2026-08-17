import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import ChatPage from './index';
import { ToastProvider } from '../../components/ui/toast';
import * as api from '../../lib/api-client';
import type { Agent } from '../../types/agent';
import type { Message } from '../../types/message';
import type { Run } from '../../types/run';
import type { Session } from '../../types/session';

/*
  The tool registry is a catalog fetch that has nothing to say about routing, and
  `toolLabel` is imported straight from the same module by the message list, so
  the mock has to supply both.
*/
vi.mock('../../hooks/useTools', () => ({
  useTools: () => ({ tools: [], loading: false, error: null }),
  toolLabel: (_tools: unknown, toolId: string) => toolId,
}));

const agentsApi = vi.hoisted(() => ({ current: { agents: [] as Agent[] } }));
vi.mock('../../hooks/useAgents', () => ({ useAgentsContext: () => agentsApi.current }));

/*
  The page reads the shared session list, and useSessionsContext throws outside a
  provider. Mocked the same way Sidebar.test.tsx mocks it, so these tests stay on
  the page rather than on the hook, which has its own suite.
*/
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

const agent = (id: string, name: string): Agent => ({
  id,
  name,
  icon: 'A',
  description: '',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: '',
  toolIds: [],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
});

const agents = [agent('agent_support', 'Support Bot'), agent('agent_research', 'Researcher')];

const session = (id: string, agentId: string, updatedAt: string, title = `Chat ${id}`): Session => ({
  id,
  agentId,
  title,
  createdAt: '2026-08-16T08:00:00.000Z',
  updatedAt,
});

const assistant = (over: Partial<Message> = {}): Message => ({
  id: 'msg_1',
  role: 'assistant',
  content: 'The refund window is 30 days.',
  toolCalls: [],
  model: 'gemini-3.1-flash-lite',
  latencyMs: 120,
  status: 'done',
  createdAt: '2026-08-16T10:00:00.000Z',
  ...over,
});

const historyRun = (over: Partial<Run> = {}): Run => ({
  id: 'run_1',
  agentId: 'agent_support',
  agentName: 'Support Bot',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Be brief.',
  userMessage: 'what is the refund window?',
  answer: 'The refund window is 30 days.',
  status: 'done',
  error: null,
  latencyMs: 120,
  sessionId: 'sess_old',
  createdAt: '2026-08-16T09:00:00.000Z',
  toolCalls: [],
  ...over,
});

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const renderChat = (route: string, sessions: Session[] = []) => {
  sessionsApi.current.sessions = sessions;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
        </Routes>
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  );
};

const at = () => screen.getByTestId('location').textContent;

const compose = async (text: string) => {
  await userEvent.type(screen.getByRole('textbox', { name: 'Message Support Bot' }), `${text}{Enter}`);
};

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Chat options' }));
};

beforeEach(() => {
  localStorage.clear();
  agentsApi.current = { agents };
  sessionsApi.current = {
    sessions: [],
    loading: false,
    rename: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(async (id: string) => {
      sessionsApi.current.sessions = sessionsApi.current.sessions.filter(
        (item) => item.id !== id,
      );
    }),
    // The real adopt prepends to the shared list, and the page re-renders on the
    // navigation that follows, so the header menu finds the created chat.
    adopt: vi.fn((created: Session) => {
      sessionsApi.current.sessions = [
        created,
        ...sessionsApi.current.sessions.filter((item) => item.id !== created.id),
      ];
    }),
    refresh: vi.fn(),
  };
  vi.spyOn(api, 'listRunsBySession').mockResolvedValue([]);
  vi.spyOn(api, 'sendMessage').mockResolvedValue({ message: assistant() });
});

describe('Chat routing', () => {
  it('loads the conversation named by a session id', async () => {
    vi.mocked(api.listRunsBySession).mockResolvedValue([historyRun({ sessionId: 'sess_x' })]);
    renderChat('/chat/sess_x', [session('sess_x', 'agent_support', '2026-08-16T10:00:00.000Z')]);

    await waitFor(() => expect(api.listRunsBySession).toHaveBeenCalledWith('sess_x'));
    expect(await screen.findByText('The refund window is 30 days.')).toBeInTheDocument();
  });

  it("resolves an agent id to that agent's most recent chat", async () => {
    renderChat('/chat/agent_support', [
      // Newest activity first, the order the sessions hook already guarantees.
      session('sess_new', 'agent_support', '2026-08-16T10:00:00.000Z'),
      session('sess_old', 'agent_support', '2026-08-16T08:00:00.000Z'),
      session('sess_other', 'agent_research', '2026-08-16T11:00:00.000Z'),
    ]);

    await waitFor(() => expect(api.listRunsBySession).toHaveBeenCalledWith('sess_new'));
    expect(api.listRunsBySession).toHaveBeenCalledTimes(1);
  });

  it('opens an empty chat for an agent that has none', async () => {
    renderChat('/chat/agent_support', [
      session('sess_other', 'agent_research', '2026-08-16T11:00:00.000Z'),
    ]);

    expect(await screen.findByRole('textbox', { name: 'Message Support Bot' })).toBeInTheDocument();
    expect(api.listRunsBySession).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Chat options' })).not.toBeInTheDocument();
  });

  it('adopts the created session and routes to it on the first message', async () => {
    const created = session('sess_new', 'agent_support', '2026-08-16T10:00:00.000Z', 'Refunds');
    vi.mocked(api.sendMessage).mockResolvedValue({ message: assistant(), session: created });
    renderChat('/chat');

    expect(at()).toBe('/chat');
    await compose('Refund window?');

    await waitFor(() => expect(sessionsApi.current.adopt).toHaveBeenCalledWith(created));
    await waitFor(() => expect(at()).toBe('/chat/sess_new'));
    // The chat was created by this send, so its history is never fetched back.
    expect(api.listRunsBySession).not.toHaveBeenCalled();
  });

  it('leaves the user where they moved to when a send lands late', async () => {
    const created = session('sess_new', 'agent_support', '2026-08-16T10:00:00.000Z', 'Refunds');
    // The send hangs until released, standing in for a slow run.
    let release = (_value: { message: Message; session?: Session }) => {};
    vi.mocked(api.sendMessage).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderChat('/chat/agent_support');
    await compose('Refund window?');
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalled());

    // The user switches agents while that first message is still running.
    await userEvent.click(screen.getByRole('button', { name: /Support Bot/ }));
    await userEvent.click(screen.getByRole('button', { name: /Researcher/ }));
    await waitFor(() => expect(at()).toBe('/chat/agent_research'));

    release({ message: assistant(), session: created });

    // The new chat still reaches the sidebar, but the route stays where the
    // user put it: following it here would replace the screen they chose, and
    // `replace` would take the Back button with it.
    await waitFor(() => expect(sessionsApi.current.adopt).toHaveBeenCalledWith(created));
    expect(at()).toBe('/chat/agent_research');
  });
});

describe('Chat header menu', () => {
  it('renames the chat on screen', async () => {
    renderChat('/chat/sess_x', [
      session('sess_x', 'agent_support', '2026-08-16T10:00:00.000Z', 'Refunds'),
    ]);

    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Chat title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Billing{Enter}');

    expect(sessionsApi.current.rename).toHaveBeenCalledWith('sess_x', 'Billing');
  });

  it('confirms a delete, removes the chat, and leaves for a new one', async () => {
    renderChat('/chat/sess_x', [
      session('sess_x', 'agent_support', '2026-08-16T10:00:00.000Z', 'Refunds'),
    ]);

    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // The menu closed behind the confirmation, so one Delete is left on screen.
    expect(screen.getByText('Delete Refunds?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(sessionsApi.current.remove).toHaveBeenCalledWith('sess_x'));
    await waitFor(() => expect(at()).toBe('/chat'));
  });

  it('starts a fresh session after the chat on screen is deleted', async () => {
    const created = session('sess_new', 'agent_support', '2026-08-16T10:00:00.000Z', 'Refunds');
    vi.mocked(api.sendMessage).mockResolvedValueOnce({ message: assistant(), session: created });
    renderChat('/chat');

    await compose('Refund window?');
    await waitFor(() => expect(at()).toBe('/chat/sess_new'));

    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(at()).toBe('/chat'));

    await compose('And exchanges?');
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));

    // The deleted chat left no redirect behind: this is a new conversation, not
    // an append to the one that was just removed.
    expect(vi.mocked(api.sendMessage).mock.calls[1]![2]?.sessionId).toBeUndefined();
    expect(screen.queryByText('Refund window?')).not.toBeInTheDocument();
  });
});
