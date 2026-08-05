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
  width?: number;
}

export const Popover = ({
  open,
  onClose,
  anchor,
  label,
  children,
  align = 'start',
  width,
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
    const gap = 4;

    const left = align === 'end' ? rect.right - panelWidth : rect.left;
    const wouldOverflowBottom = rect.bottom + panel.offsetHeight + gap > window.innerHeight;

    setPosition({
      top: wouldOverflowBottom ? rect.top - panel.offsetHeight - gap : rect.bottom + gap,
      // Keep an 8px margin from either edge on narrow viewports.
      left: Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8)),
    });
  }, [open, anchor, align, width]);

  useEffect(() => {
    if (!open) return;
    const trigger = anchor.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      trigger?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || trigger?.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="popover"
      role="dialog"
      aria-label={label}
      style={{ top: position.top, left: position.left, width: width ? `${width}px` : undefined }}
    >
      {children}
    </div>
  );
};
