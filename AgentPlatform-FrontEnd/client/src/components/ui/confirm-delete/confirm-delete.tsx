import type { RefObject } from 'react';
import { Button } from '../button';
import { Popover } from '../popover';
import './confirm-delete.css';

interface ConfirmDeleteProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  anchor: RefObject<HTMLElement | null>;
  itemName: string;
  actionLabel?: string;
}

export const ConfirmDelete = ({
  open,
  onClose,
  onConfirm,
  anchor,
  itemName,
  actionLabel = 'Delete',
}: ConfirmDeleteProps) => (
  <Popover
    open={open}
    onClose={onClose}
    anchor={anchor}
    label={`${actionLabel} ${itemName}`}
    align="end"
    width={280}
  >
    <div className="confirm-delete">
      <p className="confirm-delete__question">
        {actionLabel} {itemName}?
      </p>
      <p className="confirm-delete__note">This can&rsquo;t be undone.</p>
      <div className="confirm-delete__actions">
        <Button size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="confirm-delete__confirm"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  </Popover>
);
