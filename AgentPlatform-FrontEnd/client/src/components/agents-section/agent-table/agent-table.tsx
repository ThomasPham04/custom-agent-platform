import { useRef, useState } from 'react';
import { Chip } from '../../ui/chip';
import { Popover } from '../../ui/popover';
import { Skeleton } from '../../ui/skeleton';
import { formatRelativeTime } from '../../../lib/format';
import { toolLabel } from '../../../hooks/useTools';
import type { Agent } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import './agent-table.css';

const MAX_VISIBLE_TOOLS = 2;
const SKELETON_ROWS = 3;

interface AgentRowProps {
  agent: Agent;
  tools: readonly Tool[];
  selected: boolean;
  onSelect: (id: string) => void;
  onTestInChat: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

interface AgentTableProps extends Omit<AgentRowProps, 'agent' | 'selected'> {
  agents: Agent[];
  loading: boolean;
  selectedId: string | null;
}

const AgentRow = ({
  agent,
  tools,
  selected,
  onSelect,
  onTestInChat,
  onDuplicate,
  onDelete,
}: AgentRowProps) => {
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const visible = agent.toolIds.slice(0, MAX_VISIBLE_TOOLS);
  const overflow = agent.toolIds.length - visible.length;

  return (
    <tr
      className={['agent-row', selected ? 'agent-row--selected' : ''].filter(Boolean).join(' ')}
      data-agent-row={agent.id}
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(agent.id);
      }}
    >
      <td className="agent-row__name">
        <span className="agent-row__icon" aria-hidden="true">
          {agent.icon}
        </span>
        <span className="agent-row__name-text" title={agent.name}>
          {agent.name}
        </span>
      </td>
      <td className="agent-row__description" title={agent.description}>
        {agent.description}
      </td>
      <td>
        {/* The raw id, not the friendly label: this column is machine data. */}
        <Chip>{agent.model}</Chip>
      </td>
      <td>
        {agent.toolIds.length === 0 ? (
          <span className="agent-row__dash">—</span>
        ) : (
          <span className="agent-row__tools">
            {visible.map((toolId) => (
              <Chip key={toolId} tone="trace">
                {toolLabel(tools, toolId)}
              </Chip>
            ))}
            {overflow > 0 && <span className="agent-row__overflow mono">+{overflow}</span>}
          </span>
        )}
      </td>
      <td>
        <span className="agent-row__status">
          <span className={`agent-row__dot agent-row__dot--${agent.status}`} aria-hidden="true" />
          {agent.status === 'active' ? 'Active' : 'Draft'}
        </span>
      </td>
      <td className="agent-row__updated mono">{formatRelativeTime(agent.updatedAt)}</td>
      <td className="agent-row__actions">
        <button
          ref={menuRef}
          type="button"
          className="agent-row__menu"
          aria-label={`Actions for ${agent.name}`}
          onClick={(event) => {
            // The row is clickable; the menu must not also select it.
            event.stopPropagation();
            setMenuOpen(true);
          }}
        >
          ⋯
        </button>
        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchor={menuRef}
          label={`Actions for ${agent.name}`}
          align="end"
          width={200}
        >
          <button
            type="button"
            className="popover__item"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onTestInChat(agent.id);
            }}
          >
            Test in chat
          </button>
          <button
            type="button"
            className="popover__item"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onDuplicate(agent.id);
            }}
          >
            Duplicate
          </button>
          <div className="popover__divider" />
          <button
            type="button"
            className="popover__item popover__item--danger"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onDelete(agent.id);
            }}
          >
            Delete
          </button>
        </Popover>
      </td>
    </tr>
  );
};

export const AgentTable = ({
  agents,
  tools,
  loading,
  selectedId,
  onSelect,
  onTestInChat,
  onDuplicate,
  onDelete,
}: AgentTableProps) => (
  <table className="agent-table" aria-label="Agents">
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col" className="agent-table__col-description">
          Description
        </th>
        <th scope="col">Model</th>
        <th scope="col">Tools</th>
        <th scope="col" className="agent-table__col-status">
          Status
        </th>
        <th scope="col">Updated</th>
        <th scope="col">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
    <tbody>
      {loading
        ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <tr key={index} className="agent-row agent-row--skeleton">
              <td>
                <Skeleton width="140px" />
              </td>
              <td className="agent-table__col-description">
                <Skeleton width="200px" />
              </td>
              <td>
                <Skeleton width="90px" />
              </td>
              <td>
                <Skeleton width="70px" />
              </td>
              <td className="agent-table__col-status">
                <Skeleton width="50px" />
              </td>
              <td>
                <Skeleton width="48px" />
              </td>
              <td />
            </tr>
          ))
        : agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              tools={tools}
              selected={agent.id === selectedId}
              onSelect={onSelect}
              onTestInChat={onTestInChat}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
    </tbody>
  </table>
);
