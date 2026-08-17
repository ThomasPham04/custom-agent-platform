import { useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { ConfirmDelete } from '../ui/confirm-delete';
import { Popover } from '../ui/popover';
import { useToast } from '../ui/toast';
import { useSessionsContext } from '../../hooks/useSessions';
import type { Agent } from '../../types/agent';
import type { Session } from '../../types/session';
import './session-row.css';

interface SessionRowProps {
  session: Session;
  /**
   * Resolved by the parent from session.agentId, so renaming an agent shows the
   * new identity at once — the reason the row stores no snapshot of its own. It
   * is undefined once that agent is deleted, and the row falls back to the same
   * glyph the Chat item wears.
   */
  agent: Agent | undefined;
  onClose: () => void;
}

export const SessionRow = ({ session, agent, onClose }: SessionRowProps) => {
  const { rename, remove } = useSessionsContext();
  const { show } = useToast();
  const navigate = useNavigate();
  /*
    The sidebar renders outside <Routes>, so useParams has no match to read
    here. The pathname is the only thing that says which chat is on screen.
  */
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const menuRef = useRef<HTMLButtonElement>(null);
  /*
    Enter commits and unmounts the input, which can also fire blur; without this
    latch the same rename would be sent twice. Escape lowers it too, so the blur
    that follows a cancel stays a no-op.
  */
  const open = useRef(false);

  const startEditing = () => {
    setDraft(session.title);
    open.current = true;
    setEditing(true);
  };

  const cancel = () => {
    open.current = false;
    setEditing(false);
    setDraft(session.title);
  };

  const commit = () => {
    if (!open.current) return;
    open.current = false;
    setEditing(false);

    const title = draft.trim();
    // Nothing to save: an empty box or the title it already has is not a request.
    if (!title || title === session.title) {
      setDraft(session.title);
      return;
    }

    void rename(session.id, title).catch((thrown: unknown) => {
      // The hook has already rolled the list back; the row is the only place
      // that can say why the title it just showed went away.
      setDraft(session.title);
      show(thrown instanceof Error ? thrown.message : 'Could not rename the chat. Try again.');
    });
  };

  if (editing) {
    return (
      <input
        className="session-row__input"
        aria-label="Chat title"
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') cancel();
        }}
      />
    );
  }

  return (
    <div className="session-row">
      <NavLink
        to={`/chat/${session.id}`}
        className="sidebar__item sidebar__item--child"
        onClick={onClose}
      >
        <span className="sidebar__item-icon" aria-hidden="true">
          {agent?.icon ?? '✉'}
        </span>
        <span className="sidebar__item-text">{session.title}</span>
      </NavLink>

      <button
        ref={menuRef}
        type="button"
        className="session-row__menu"
        aria-label={`Chat options for ${session.title}`}
        onClick={() => setMenuOpen(true)}
      >
        ⋯
      </button>

      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchor={menuRef}
        label={`Chat options for ${session.title}`}
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
            // Deleting a chat takes its whole history with it, so it confirms —
            // the same safeguard the agent row's Delete gets.
            setConfirming(true);
          }}
        >
          Delete
        </button>
      </Popover>

      <ConfirmDelete
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          void remove(session.id)
            .then(() => {
              /*
                Deleting the chat being read has to take the reader off it.
                The route would otherwise stay parked on a session the server
                no longer has: the header loses its title and menu, but the
                thread keeps rendering and the composer would post the next
                message against a deleted session. Only on success — a delete
                the server refused leaves the chat in place, and moving anyone
                off a conversation that still exists would be worse than the
                error they already get.
              */
              if (pathname === `/chat/${session.id}`) navigate('/chat');
            })
            .catch((thrown: unknown) => {
              show(
                thrown instanceof Error ? thrown.message : 'Could not delete the chat. Try again.',
              );
            });
        }}
        anchor={menuRef}
        itemName={session.title}
      />
    </div>
  );
};
