import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDelete } from './confirm-delete';

const Harness = ({ onConfirm, actionLabel }: { onConfirm: () => void; actionLabel?: string }) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Delete agent
      </button>
      <ConfirmDelete
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        anchor={anchor}
        itemName="Support Bot"
        actionLabel={actionLabel}
      />
    </div>
  );
};

describe('ConfirmDelete', () => {
  it('names the item it is about to delete', async () => {
    render(<Harness onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    expect(screen.getByText(/Delete Support Bot\?/)).toBeInTheDocument();
    expect(screen.getByText(/can’t be undone/)).toBeInTheDocument();
  });

  it('uses a centered modal rather than an anchored popover', async () => {
    render(<Harness onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete Support Bot' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('confirm-delete-modal');
    expect(dialog).not.toHaveClass('popover');
  });

  it('confirms and closes', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses a configured action name throughout a non-delete confirmation', async () => {
    render(<Harness onConfirm={() => {}} actionLabel="Clear" />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));

    expect(screen.getByRole('dialog', { name: 'Clear Support Bot' })).toBeInTheDocument();
    expect(screen.getByText('Clear Support Bot?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
