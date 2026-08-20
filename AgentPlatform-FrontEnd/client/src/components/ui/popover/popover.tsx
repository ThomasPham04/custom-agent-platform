import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import './popover.css';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  label: string;
  children: ReactNode;
  align?: 'start' | 'end';
  /**
   * Which side of the trigger the panel takes. 'bottom' drops it under the
   * trigger and `align` decides the edge they share; 'right' sets it beside the
   * trigger with their tops level, which is what a narrow control in a rail
   * wants — there is no room under it, but the whole page is to its right.
   */
  placement?: 'bottom' | 'right';
  width?: number;
  initialFocus?: RefObject<HTMLElement | null>;
}

/** Kept off both the trigger and the viewport edge. */
const GAP = 4;
const MARGIN = 8;

export const Popover = ({
  open,
  onClose,
  anchor,
  label,
  children,
  align = 'start',
  placement = 'bottom',
  width,
  initialFocus,
}: PopoverProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Measure before paint so the panel never renders at 0,0 first.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = anchor.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = width ?? panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    // Keep a margin from either edge on narrow viewports.
    const clamp = (value: number, extent: number, limit: number) =>
      Math.max(MARGIN, Math.min(value, limit - extent - MARGIN));

    if (placement === 'right') {
      // Flip to the other side rather than run off the edge — the same reflex
      // the bottom placement has when there is no room below.
      const wouldOverflowRight = rect.right + GAP + panelWidth + MARGIN > window.innerWidth;
      setPosition({
        top: clamp(rect.top, panelHeight, window.innerHeight),
        left: Math.max(
          MARGIN,
          wouldOverflowRight ? rect.left - panelWidth - GAP : rect.right + GAP,
        ),
      });
      return;
    }

    const left = align === 'end' ? rect.right - panelWidth : rect.left;
    const wouldOverflowBottom = rect.bottom + panelHeight + GAP > window.innerHeight;

    setPosition({
      top: wouldOverflowBottom ? rect.top - panelHeight - GAP : rect.bottom + GAP,
      left: clamp(left, panelWidth, window.innerWidth),
    });
  }, [open, anchor, align, placement, width]);

  useLayoutEffect(() => {
    if (!open) return;
    const target =
      initialFocus?.current ??
      panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
    target?.focus();
  }, [initialFocus, open]);

  useEffect(() => {
    if (!open) return;
    const trigger = anchor.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      /*
        Capture phase, so an open popover claims Escape before anything that
        contains it. A popover inside the agent peek would otherwise close the
        whole panel: both listeners live on document, and the peek registers
        first, so a bubble-phase stopPropagation() would come too late.
      */
      event.stopPropagation();
      onClose();
      trigger?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || trigger?.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={placement === 'right' ? 'popover popover--right' : 'popover'}
      role="dialog"
      aria-label={label}
      style={{ top: position.top, left: position.left, width: width ? `${width}px` : undefined }}
    >
      {children}
    </div>
  );
};
