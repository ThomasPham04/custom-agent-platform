import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolPicker } from './tool-picker';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: 'Reads the time.', params: [] },
  { id: 'http_request', label: 'HTTP request', description: 'Fetches a URL.', params: [] },
  { id: 'calculator', label: 'Calculator', description: 'Does arithmetic.', params: [] },
  { id: 'knowledge_search', label: 'Knowledge search', description: 'Searches docs.', params: [] },
];

const Harness = ({ onChange }: { onChange: (ids: string[]) => void }) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(['current_time']);

  return (
    <div>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Add tool
      </button>
      <ToolPicker
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        tools={tools}
        selectedIds={selected}
        onChange={(ids) => {
          setSelected(ids);
          onChange(ids);
        }}
      />
    </div>
  );
};

const open = async () => userEvent.click(screen.getByRole('button', { name: 'Add tool' }));

describe('ToolPicker', () => {
  it('shows readable labels without rendering wire ids', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    expect(screen.getByRole('checkbox', { name: 'Current time' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Calculator' })).not.toBeChecked();
    expect(screen.queryByText('knowledge_search')).not.toBeInTheDocument();
  });

  it('counts the selection', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    expect(screen.getByText('1 of 4 selected')).toBeInTheDocument();
  });

  it('adds a tool on click, preserving what was already selected', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('checkbox', { name: /Calculator/ }));
    expect(onChange).toHaveBeenCalledWith(['current_time', 'calculator']);
  });

  it('removes a tool when it is unchecked', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('checkbox', { name: /Current time/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('filters by label and by id', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    const search = screen.getByRole('searchbox', { name: 'Search tools' });

    await userEvent.type(search, 'calc');
    expect(screen.getByRole('checkbox', { name: /Calculator/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Current time/ })).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'http_');
    expect(screen.getByRole('checkbox', { name: /HTTP request/ })).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tools' }), 'teleport');
    expect(screen.getByText('No tools match that search.')).toBeInTheDocument();
  });

  it('moves through tools with arrows, toggles with Space, and closes with Enter', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Add tool' });
    await userEvent.click(trigger);

    const search = screen.getByRole('searchbox', { name: 'Search tools' });
    expect(search).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('checkbox', { name: /Current time/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('checkbox', { name: /HTTP request/ })).toHaveFocus();

    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(['current_time', 'http_request']);

    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('dialog', { name: 'Attach tools' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
