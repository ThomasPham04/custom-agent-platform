import { useEffect, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover } from './popover';

const Harness = () => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Open menu
      </button>
      <button type="button">Outside</button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Row actions">
        <button type="button">Duplicate</button>
      </Popover>
    </div>
  );
};

describe('Popover', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with an accessible name', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the anchor', async () => {
    render(<Harness />);
    const anchor = screen.getByRole('button', { name: 'Open menu' });
    await userEvent.click(anchor);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(anchor).toHaveFocus();
  });

  it('closes when a pointer goes down outside it', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open when clicking its own content', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('claims Escape from an enclosing panel that also listens for it', async () => {
    // Mirrors the tool picker inside the agent peek: Escape must close only the
    // popover, leaving the panel around it open.
    const Nested = () => {
      const anchor = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      const [panelClosed, setPanelClosed] = useState(false);

      useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') setPanelClosed(true);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
      }, []);

      return (
        <div>
          {panelClosed && <span>panel closed</span>}
          <button ref={anchor} type="button" onClick={() => setOpen(true)}>
            Attach a tool
          </button>
          <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Attach tools">
            <button type="button">current_time</button>
          </Popover>
        </div>
      );
    };

    render(<Nested />);
    await userEvent.click(screen.getByRole('button', { name: 'Attach a tool' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('panel closed')).not.toBeInTheDocument();
  });
});
