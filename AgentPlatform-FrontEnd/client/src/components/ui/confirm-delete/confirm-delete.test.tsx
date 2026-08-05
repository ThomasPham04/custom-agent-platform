import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDelete } from './confirm-delete';

const Harness = ({ onConfirm }: { onConfirm: () => void }) => {
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
});
