import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentSwitcher } from '../../components/chat-section/agent-switcher/agent-switcher';
import { Composer } from '../../components/chat-section/composer';
import { MessageList } from '../../components/chat-section/message-list';
import { ConfirmDelete } from '../../components/ui/confirm-delete';
import { Popover } from '../../components/ui/popover';
import { useToast } from '../../components/ui/toast';
import { useAgentsContext } from '../../hooks/useAgents';
import { useChat } from '../../hooks/useChat';
import { useSessionsContext } from '../../hooks/useSessions';
import { useTools } from '../../hooks/useTools';
import type { Session } from '../../types/session';
import './chat.css';

const LAST_AGENT_KEY = 'agentPlatform.lastAgentId';
const SESSION_PREFIX = 'sess_';
const AGENT_PREFIX = 'agent_';

const ChatPage = () => {
  /*
    Ids carry their kind in the prefix, so one route serves both. That is what
    keeps existing /chat/agent_xyz links and the remembered-agent key working
    alongside a link straight to one conversation.
  */
  const { id } = useParams();
  const navigate = useNavigate();
  const { agents } = useAgentsContext();
  const { tools } = useTools();
  const { sessions, loading: sessionsLoading, rename, remove, adopt } = useSessionsContext();
  const { show } = useToast();

  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  /*
    Enter commits and unmounts the input, which also fires blur; without this
    latch the same rename would be sent twice. Escape lowers it too, so the blur
    that follows a cancel stays a no-op. Same mechanism as the sidebar row.
  */
  const open = useRef(false);

  const routedSessionId = id?.startsWith(SESSION_PREFIX) ? id : null;
  const routedAgentId = id?.startsWith(AGENT_PREFIX) ? id : null;
  /*
    `sessions` arrives ordered by newest activity, so the first match is that
    agent's most recent chat. An agent with no chats resolves to null, which is
    an empty new chat with that agent.
  */
  const newestForAgent = routedAgentId
    ? sessions.find((item) => item.agentId === routedAgentId)
    : undefined;
  /*
    A session route trusts its own id rather than waiting for the list: a deep
    link and a reload both have to hydrate before the sidebar's fetch lands.
  */
  const sessionId = routedSessionId ?? newestForAgent?.id ?? null;
  const session = sessionId ? (sessions.find((item) => item.id === sessionId) ?? null) : null;

  // The session names the agent; a route without one falls back to the last
  // agent this browser used, then to whatever exists.
  const remembered = localStorage.getItem(LAST_AGENT_KEY);
  const selected =
    agents.find((agent) => agent.id === session?.agentId) ??
    agents.find((agent) => agent.id === routedAgentId) ??
    agents.find((agent) => agent.id === remembered) ??
    agents[0] ??
    null;

  /*
    A session deep link cannot name its agent until the list resolves it, and
    the chat POST is addressed by agent. Sending in that window would aim the
    turn at the fallback agent, which the server rejects as a mismatch, so the
    composer waits the moment out.
  */
  const awaitingSession = Boolean(routedSessionId) && !session && sessionsLoading;

  const { messages, sending, loading, send, retry, forget } = useChat(
    sessionId,
    selected?.id ?? null,
  );

  useEffect(() => {
    if (selected && !awaitingSession) localStorage.setItem(LAST_AGENT_KEY, selected.id);
  }, [awaitingSession, selected]);

  // Opening another chat closes anything the previous one had open, so a menu
  // or a half-typed title never carries across conversations.
  useEffect(() => {
    open.current = false;
    setMenuOpen(false);
    setConfirming(false);
    setEditing(false);
  }, [sessionId]);

  /*
    The route the user is actually looking at, readable from an async
    continuation. Same reason useChat mirrors threadsRef: a reply that lands
    after the route moved must read where the user is now, not the render it
    was sent from.
  */
  const routeRef = useRef(id);
  useEffect(() => {
    routeRef.current = id;
  }, [id]);

  /*
    The first message of a new chat comes back with the session the server
    created. Adopting it puts the chat in the sidebar without refetching the
    list, and the route follows so a reload lands on the same conversation.
    `replace`, so Back does not return to the empty chat it grew out of.

    `from` is the chat the send started in, captured at the call. The route
    only follows if the user is still there: a reply that lands after they
    switched agents or opened another conversation still belongs in the
    sidebar, but dragging them back to it would discard the screen they chose
    — and `replace` would take the Back button with it.
  */
  const openCreated = (from: string | undefined) => (created: Session | undefined) => {
    if (!created) return;
    adopt(created);
    if (routeRef.current !== from) return;
    navigate(`/chat/${created.id}`, { replace: true });
  };

  const startEditing = () => {
    if (!session) return;
    setDraft(session.title);
    open.current = true;
    setEditing(true);
  };

  const cancelEditing = () => {
    open.current = false;
    setEditing(false);
    setDraft(session?.title ?? '');
  };

  const commitEditing = () => {
    if (!open.current || !session) return;
    open.current = false;
    setEditing(false);

    const title = draft.trim();
    // Nothing to save: an empty box or the title it already has is not a request.
    if (!title || title === session.title) {
      setDraft(session.title);
      return;
    }

    void rename(session.id, title).catch((thrown: unknown) => {
      // The hook has already rolled the list back; the header is the only place
      // that can say why the title it just showed went away.
      setDraft(session.title);
      show(thrown instanceof Error ? thrown.message : 'Could not rename the chat. Try again.');
    });
  };

  const deleteSession = () => {
    if (!session) return;
    const deleted = session.id;
    void remove(deleted)
      .then(() => {
        // Nothing on this screen may still point at the deleted chat: forget
        // drops its thread and retires the redirect a new chat left behind, so
        // the next message opens a conversation instead of appending to a gone one.
        forget(deleted);
        navigate('/chat');
      })
      .catch((thrown: unknown) => {
        show(thrown instanceof Error ? thrown.message : 'Could not delete the chat. Try again.');
      });
  };

  return (
    <div className="chat">
      <div className="chat__header">
        <AgentSwitcher
          agents={agents}
          selected={selected}
          onSelect={(agent) => navigate(`/chat/${agent}`)}
        />

        {session &&
          (editing ? (
            <input
              className="chat__title-input"
              aria-label="Chat title"
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitEditing}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitEditing();
                if (event.key === 'Escape') cancelEditing();
              }}
            />
          ) : (
            <span className="chat__title">{session.title}</span>
          ))}

        <div className="chat__header-right">
          {selected && <span className="chat__model mono">{selected.model}</span>}
          {session && (
            <>
              <button
                ref={menuRef}
                type="button"
                className="chat__menu"
                aria-label="Chat options"
                // Renaming or deleting mid-run would touch the chat before the
                // server has finished writing the turn into it.
                disabled={sending}
                onClick={() => setMenuOpen(true)}
              >
                ⋯
              </button>

              <Popover
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchor={menuRef}
                label="Chat options"
                align="end"
                width={160}
              >
                <button
                  type="button"
                  className="popover__item"
                  onClick={() => {
                    setMenuOpen(false);
                    startEditing();
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="popover__item popover__item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    // Deleting a chat takes its whole history with it, so it
                    // confirms — the same safeguard the sidebar row gets.
                    setConfirming(true);
                  }}
                >
                  Delete
                </button>
              </Popover>

              <ConfirmDelete
                open={confirming}
                onClose={() => setConfirming(false)}
                onConfirm={deleteSession}
                anchor={menuRef}
                itemName={session.title}
              />
            </>
          )}
        </div>
      </div>

      <div className="chat__column">
        <MessageList
          messages={messages}
          agent={selected}
          agents={agents}
          tools={tools}
          loading={loading}
          onRetry={(messageId) => void retry(messageId).then(openCreated(id))}
          onPickPrompt={(prompt) => void send(prompt).then(openCreated(id))}
          onGoToAgents={() => navigate('/agents')}
        />
        {selected && (
          <Composer
            agentName={selected.name}
            disabled={sending || awaitingSession}
            onSend={(content) => void send(content).then(openCreated(id))}
          />
        )}
      </div>
    </div>
  );
};

export default ChatPage;
