import { useMemo, useState } from 'react';
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

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return tools;
    // Search the id too: people who know the tool by its wire name find it faster.
    return tools.filter(
      (tool) =>
        tool.label.toLowerCase().includes(needle) || tool.id.toLowerCase().includes(needle),
    );
  }, [tools, query]);

  const toggle = (toolId: string) => {
    onChange(
      selectedIds.includes(toolId)
        ? selectedIds.filter((id) => id !== toolId)
        : [...selectedIds, toolId],
    );
  };

  return (
    <Popover open={open} onClose={onClose} anchor={anchor} label="Attach tools" width={320}>
      <div className="tool-picker">
        <input
          type="search"
          className="tool-picker__search"
          aria-label="Search tools"
          placeholder="Search tools…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <ul className="tool-picker__list">
          {matches.map((tool) => (
            <li key={tool.id}>
              <label className="tool-picker__row">
                <input
                  type="checkbox"
                  className="tool-picker__checkbox"
                  checked={selectedIds.includes(tool.id)}
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
