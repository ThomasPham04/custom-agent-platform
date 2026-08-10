import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Popover } from '../../ui/popover';
import type { Tool } from '../../../types/tool';
import './tool-picker.css';

interface ToolPickerProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  tools: readonly Tool[];
  selectedIds: readonly string[];
  onChange: (toolIds: string[]) => void;
}

export const ToolPicker = ({
  open,
  onClose,
  anchor,
  tools,
  selectedIds,
  onChange,
}: ToolPickerProps) => {
  const [query, setQuery] = useState('');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const checkboxRefs = useRef(new Map<string, HTMLInputElement>());

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return tools;
    // Search the id too: people who know the tool by its wire name find it faster.
    return tools.filter(
      (tool) =>
        tool.label.toLowerCase().includes(needle) || tool.id.toLowerCase().includes(needle),
    );
  }, [tools, query]);

  useEffect(() => {
    if (!open) return;
    const selectedMatch = matches.find((tool) => selectedIds.includes(tool.id));
    setActiveToolId(selectedMatch?.id ?? matches[0]?.id ?? null);
  }, [open]);

  useEffect(() => {
    if (activeToolId && matches.some((tool) => tool.id === activeToolId)) return;
    setActiveToolId(matches[0]?.id ?? null);
  }, [activeToolId, matches]);

  const toggle = (toolId: string) => {
    onChange(
      selectedIds.includes(toolId)
        ? selectedIds.filter((id) => id !== toolId)
        : [...selectedIds, toolId],
    );
  };

  const move = (direction: 1 | -1, fromSearch: boolean) => {
    if (matches.length === 0) return;
    const currentIndex = matches.findIndex((tool) => tool.id === activeToolId);
    const nextIndex = fromSearch
      ? direction === 1
        ? Math.max(currentIndex, 0)
        : currentIndex >= 0
          ? currentIndex
          : matches.length - 1
      : (Math.max(currentIndex, 0) + direction + matches.length) % matches.length;
    const nextId = matches[nextIndex]?.id;
    if (!nextId) return;
    setActiveToolId(nextId);
    checkboxRefs.current.get(nextId)?.focus();
  };

  const closeAndReturnFocus = () => {
    onClose();
    anchor.current?.focus();
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      label="Attach tools"
      width={320}
      initialFocus={searchRef}
    >
      <div
        className="tool-picker"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            move(event.key === 'ArrowDown' ? 1 : -1, event.target === searchRef.current);
          } else if (
            event.key === ' ' &&
            event.target instanceof HTMLInputElement &&
            event.target.type === 'checkbox'
          ) {
            event.preventDefault();
            toggle(event.target.value);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            closeAndReturnFocus();
          }
        }}
      >
        <input
          ref={searchRef}
          type="search"
          className="tool-picker__search"
          aria-label="Search tools"
          placeholder="Search toolsâ€¦"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <ul className="tool-picker__list">
          {matches.map((tool) => (
            <li key={tool.id}>
              <label className="tool-picker__row">
                <input
                  ref={(node) => {
                    if (node) checkboxRefs.current.set(tool.id, node);
                    else checkboxRefs.current.delete(tool.id);
                  }}
                  type="checkbox"
                  className="tool-picker__checkbox"
                  checked={selectedIds.includes(tool.id)}
                  value={tool.id}
                  tabIndex={tool.id === activeToolId ? 0 : -1}
                  onChange={() => toggle(tool.id)}
                />
                <span className="tool-picker__text">
                  <span className="tool-picker__label">{tool.label}</span>
                  <span className="tool-picker__id mono">{tool.id}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {matches.length === 0 && <p className="tool-picker__empty">No tools match that search.</p>}

        <p className="tool-picker__footer mono">
          {selectedIds.length} of {tools.length} selected
        </p>
      </div>
    </Popover>
  );
};
