import { useMemo, useRef, useState, type RefObject } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { Popover } from '../ui/popover';
import { Chevron } from '../ui/chevron';
import { SessionRow } from './session-row';
import { useApiHealth, type ApiHealth } from '../../hooks/useApiHealth';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useSessionsContext } from '../../hooks/useSessions';
import type { Agent } from '../../types/agent';
import './Sidebar.css';

interface SidebarProps {
  /**
   * The sidebar no longer lists agents, but each chat row resolves its icon
   * from session.agentId, so the list still has to be here.
   */
  agents: Agent[];
  open: boolean;
  onClose: () => void;
  isDrawer?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * The mode comes from /api/health, never from a constant here: the API decides
 * whether it is serving mock fixtures or a live model, and a hardcoded label
 * would keep saying "mock" while the real one answered.
 */
const healthText = ({ status, mode }: ApiHealth) => {
  if (status === 'checking') return 'checking…';
  if (status === 'offline') return 'api offline';
  return mode ? `connected · ${mode}` : 'connected';
};

export const Sidebar = ({
  agents,
  open,
  onClose,
  isDrawer = false,
  returnFocusRef,
}: SidebarProps) => {
  const navigationRef = useRef<HTMLElement>(null);
  /*
    Open on arrival: the chat history is what this sidebar is for now that
    Agents is a plain link, and a collapsed start would show an empty rail and
    hide the list behind a control most people never click.
  */
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLButtonElement>(null);
  const health = useApiHealth();
  const navigate = useNavigate();
  const { sessions, loading } = useSessionsContext();

  const agentsById = useMemo(() => new Map(agents.map((item) => [item.id, item])), [agents]);

  useModalFocus({
    active: isDrawer && open,
    containerRef: navigationRef,
    returnFocusRef,
  });

  return (
    <nav
      ref={navigationRef}
      className={['sidebar', open ? 'sidebar--open' : ''].filter(Boolean).join(' ')}
      aria-label="Workspace"
      aria-hidden={isDrawer && !open ? 'true' : undefined}
      inert={isDrawer && !open ? true : undefined}
    >
      <button
        ref={workspaceRef}
        type="button"
        className="sidebar__workspace"
        onClick={() => setWorkspaceOpen(true)}
      >
        <span className="sidebar__workspace-mark" aria-hidden="true">
          ▦
        </span>
        <span className="sidebar__workspace-name">Agent Platform</span>
        <span className="sidebar__chevron">
          <Chevron />
        </span>
      </button>

      <Popover
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        anchor={workspaceRef}
        label="Workspace"
        width={216}
      >
        <p className="popover__note">
          Mock workspace. Agents and runs reset when the API restarts.
        </p>
      </Popover>

      <p className="sidebar__label">Workspace</p>

      {/*
        Agents is a plain link with nothing under it: the Agents page lists and
        filters them far better than a nested column can. The spacer keeps its
        label on the same left edge as Chat, which does have a disclosure.
      */}
      <div className="sidebar__group">
        <span className="sidebar__disclosure sidebar__disclosure--spacer" aria-hidden="true" />
        <NavLink to="/agents" className="sidebar__item" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ▤
          </span>
          Agents
        </NavLink>
      </div>

      <div className="sidebar__group">
        <button
          type="button"
          className="sidebar__disclosure"
          aria-expanded={chatsExpanded}
          aria-label={chatsExpanded ? 'Collapse chats' : 'Expand chats'}
          onClick={() => setChatsExpanded((expanded) => !expanded)}
        >
          <span
            className={['sidebar__triangle', chatsExpanded ? 'sidebar__triangle--open' : '']
              .filter(Boolean)
              .join(' ')}
          >
            ▸
          </span>
        </button>
        <NavLink to="/chat" className="sidebar__item" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ✉
          </span>
          Chat
        </NavLink>
        <button
          type="button"
          className="sidebar__add"
          aria-label="New chat"
          onClick={() => {
            onClose();
            navigate('/chat');
          }}
        >
          +
        </button>
      </div>

      {chatsExpanded && (
        <ul className="sidebar__children">
          {sessions.map((item) => (
            <li key={item.id}>
              <SessionRow session={item} agent={agentsById.get(item.agentId)} onClose={onClose} />
            </li>
          ))}
          {/* Not "No chats yet" while the first fetch is still out — that reads
              as an answer when it is only an unfinished question. */}
          {!loading && sessions.length === 0 && (
            <li className="sidebar__children-empty">No chats yet</li>
          )}
        </ul>
      )}

      <div className="sidebar__footer">
        <span className={`sidebar__dot sidebar__dot--${health.status}`} aria-hidden="true" />
        <span className="sidebar__health mono">{healthText(health)}</span>
      </div>
    </nav>
  );
};
