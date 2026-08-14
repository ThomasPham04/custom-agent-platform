import { useRef, useState, type RefObject } from 'react';
import { NavLink } from 'react-router';
import { Popover } from '../ui/popover';
import { Chevron } from '../ui/chevron';
import { useApiHealth, type ApiHealth } from '../../hooks/useApiHealth';
import { useModalFocus } from '../../hooks/useModalFocus';
import type { Agent } from '../../types/agent';
import './Sidebar.css';

interface SidebarProps {
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
  const [agentsExpanded, setAgentsExpanded] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLButtonElement>(null);
  const health = useApiHealth();

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

      <div className="sidebar__group">
        <button
          type="button"
          className="sidebar__disclosure"
          aria-expanded={agentsExpanded}
          aria-label={agentsExpanded ? 'Collapse agents' : 'Expand agents'}
          onClick={() => setAgentsExpanded((expanded) => !expanded)}
        >
          <span
            className={['sidebar__triangle', agentsExpanded ? 'sidebar__triangle--open' : '']
              .filter(Boolean)
              .join(' ')}
          >
            ▸
          </span>
        </button>
        <NavLink to="/agents" className="sidebar__item" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ▤
          </span>
          Agents
        </NavLink>
      </div>

      {agentsExpanded && (
        <ul className="sidebar__children">
          {agents.map((item) => (
            <li key={item.id}>
              <NavLink
                to={`/agents/${item.id}`}
                className="sidebar__item sidebar__item--child"
                onClick={onClose}
              >
                <span className="sidebar__item-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="sidebar__item-text">{item.name}</span>
              </NavLink>
            </li>
          ))}
          {agents.length === 0 && <li className="sidebar__children-empty">No agents yet</li>}
        </ul>
      )}

      <div className="sidebar__group">
        <span className="sidebar__disclosure sidebar__disclosure--spacer" aria-hidden="true" />
        <NavLink to="/chat" className="sidebar__item" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ✉
          </span>
          Chat
        </NavLink>
      </div>

      <div className="sidebar__footer">
        <span className={`sidebar__dot sidebar__dot--${health.status}`} aria-hidden="true" />
        <span className="sidebar__health mono">{healthText(health)}</span>
      </div>
    </nav>
  );
};
