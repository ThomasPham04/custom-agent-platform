import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { Button } from '../button';
import { useModalFocus } from '../../../hooks/useModalFocus';
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
}: ConfirmDeleteProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useModalFocus({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
    returnFocusRef: anchor,
    isolateOutside: true,
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="confirm-delete-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${actionLabel} ${itemName}`}
      onClick={onClose}
    >
      <div className="confirm-delete-modal__card" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-delete">
          <p id={titleId} className="confirm-delete__question">
            {actionLabel} {itemName}?
          </p>
          <p className="confirm-delete__note">This can&rsquo;t be undone.</p>
          <div className="confirm-delete__actions">
            <button
              ref={cancelRef}
              type="button"
              className="button button--secondary button--sm"
              onClick={onClose}
            >
              Cancel
            </button>
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
      </div>
    </div>,
    document.body,
  );
};
