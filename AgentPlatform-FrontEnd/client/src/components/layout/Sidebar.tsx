import { useMemo, useRef, useState, type RefObject } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { AgentPicker } from '../ui/agent-picker';
import { Popover } from '../ui/popover';
import { SessionRow } from './session-row';
import { useApiHealth, type ApiHealth } from '../../hooks/useApiHealth';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useSessionsContext } from '../../hooks/useSessions';
import { useWalkthroughContext } from '../../hooks/useWalkthrough';
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
  const [newChatOpen, setNewChatOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const walkthroughRef = useRef<HTMLButtonElement>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const { catalog, start } = useWalkthroughContext();
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
      data-walkthrough="sidebar"
      className={['sidebar', open ? 'sidebar--open' : ''].filter(Boolean).join(' ')}
      aria-label="Workspace"
      aria-hidden={isDrawer && !open ? 'true' : undefined}
      inert={isDrawer && !open ? true : undefined}
    >
      <div className="sidebar__workspace">
        <span className="sidebar__workspace-mark" aria-hidden="true">
          ▦
        </span>
        <span className="sidebar__workspace-name">Agent Platform</span>
      </div>

      <p className="sidebar__label">Workspace</p>

      {/*
        Agents is a plain link with nothing under it: the Agents page lists and
        filters them far better than a nested column can. The spacer keeps its
        label on the same left edge as Chat, which does have a disclosure.
      */}
      <div className="sidebar__group">
        <span className="sidebar__disclosure sidebar__disclosure--spacer" aria-hidden="true" />
        <NavLink to="/agents" className="sidebar__item" data-walkthrough="sidebar-agents" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ▤
          </span>
          Agents
        </NavLink>
      </div>

      {/* Same shape as Agents: a plain link with nothing under it. The library
          is global, so there is no per-agent tree to disclose. */}
      <div className="sidebar__group">
        <span className="sidebar__disclosure sidebar__disclosure--spacer" aria-hidden="true" />
        <NavLink to="/knowledge" className="sidebar__item" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ▦
          </span>
          Knowledge
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
          ref={addRef}
          type="button"
          className="sidebar__add"
          aria-label="New chat"
          aria-expanded={newChatOpen}
          onClick={() => setNewChatOpen(true)}
        >
          +
        </button>

        {/*
          Inside the group, not beside it: the panel is fixed-positioned so it
          costs the row no layout, and keeping it here means :focus-within holds
          the + visible for as long as the list it opened is on screen.

          Beside the + rather than under it, so the list never covers the chat
          history the + sits above.
        */}
        <Popover
          open={newChatOpen}
          onClose={() => setNewChatOpen(false)}
          anchor={addRef}
          label="Start a chat"
          placement="right"
          width={248}
        >
          <AgentPicker
            agents={agents}
            onSelect={(agentId) => {
              setNewChatOpen(false);
              addRef.current?.focus();
              onClose();
              /*
                `?agent=`, not `/chat/agent_x` — that route opens the agent's most
                recent conversation, and this button promises a new one. A chat
                route with no id is the empty chat; the query only says who it is
                with, so the URL stays shareable and survives a reload.
              */
              navigate(`/chat?agent=${encodeURIComponent(agentId)}`);
            }}
          />
        </Popover>
      </div>

      {chatsExpanded && (
        <ul className="sidebar__children" data-walkthrough="sidebar-chats">
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

      <button
        ref={walkthroughRef}
        type="button"
        className="sidebar__walkthrough"
        onClick={() => setWalkthroughOpen(true)}
      >
        Walkthrough
      </button>

      <Popover
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        anchor={walkthroughRef}
        label="Walkthroughs"
        width={248}
      >
        {catalog.map((walkthrough) => (
          <button
            key={walkthrough.id}
            type="button"
            className="popover__item sidebar__walkthrough-option"
            onClick={() => {
              setWalkthroughOpen(false);
              // The drawer is in the way of everything a walkthrough points at.
              onClose();
              /*
                Focus the trigger before starting: the provider captures whatever is
                focused, and this option button unmounts with the popover, leaving it
                with a disconnected element and nowhere to return focus to.
              */
              walkthroughRef.current?.focus();
              start(walkthrough.id);
            }}
          >
            <span className="sidebar__walkthrough-name">{walkthrough.name}</span>
            <span className="sidebar__walkthrough-summary">{walkthrough.summary}</span>
          </button>
        ))}
      </Popover>

      <div className="sidebar__footer">
        <span className={`sidebar__dot sidebar__dot--${health.status}`} aria-hidden="true" />
        <span className="sidebar__health mono">{healthText(health)}</span>
        <a
          className="sidebar__github"
          href="https://github.com/ThomasPham04/custom-agent-platform"
          target="_blank"
          rel="noreferrer"
          aria-label="View Agent Platform on GitHub"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.588 2 12.253c0 4.53 2.865 8.37 6.839 9.727.5.096.683-.223.683-.495 0-.244-.009-1.052-.013-1.91-2.782.62-3.369-1.218-3.369-1.218-.455-1.185-1.11-1.5-1.11-1.5-.908-.639.068-.626.068-.626 1.004.072 1.532 1.056 1.532 1.056.892 1.568 2.341 1.115 2.91.852.091-.666.349-1.115.635-1.371-2.221-.261-4.556-1.14-4.556-5.073 0-1.121.391-2.037 1.03-2.755-.104-.261-.446-1.313.098-2.738 0 0 .84-.277 2.75 1.052A9.32 9.32 0 0 1 12 6.85c.85.004 1.705.117 2.504.344 1.909-1.329 2.748-1.052 2.748-1.052.545 1.425.203 2.477.1 2.738.64.718 1.028 1.634 1.028 2.755 0 3.943-2.339 4.809-4.566 5.064.359.321.679.951.679 1.917 0 1.385-.012 2.502-.012 2.843 0 .274.18.596.688.494C19.14 20.62 22 16.782 22 12.253 22 6.588 17.522 2 12 2Z" />
          </svg>
        </a>
      </div>
    </nav>
  );
};
