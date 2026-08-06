import { useLayoutEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface UseModalFocusOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  isolateOutside?: boolean;
}

interface SavedAttributes {
  inert: string | null;
  ariaHidden: string | null;
}

const isolateSiblings = (container: HTMLElement) => {
  const saved = new Map<HTMLElement, SavedAttributes>();
  let branch: HTMLElement = container;

  while (branch.parentElement) {
    const parent = branch.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === branch || saved.has(sibling)) continue;
      saved.set(sibling, {
        inert: sibling.getAttribute('inert'),
        ariaHidden: sibling.getAttribute('aria-hidden'),
      });
      sibling.setAttribute('inert', '');
      sibling.setAttribute('aria-hidden', 'true');
    }
    if (parent === document.body) break;
    branch = parent;
  }

  return () => {
    for (const [element, attributes] of saved) {
      if (attributes.inert === null) element.removeAttribute('inert');
      else element.setAttribute('inert', attributes.inert);

      if (attributes.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', attributes.ariaHidden);
    }
  };
};

const focusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest('[inert]'),
  );

export const useModalFocus = ({
  active,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  isolateOutside = false,
}: UseModalFocusOptions) => {
  useLayoutEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const fallbackReturnTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreIsolation = isolateOutside ? isolateSiblings(container) : () => {};

    const focusInitial = () => {
      const target = initialFocusRef?.current ?? focusableElements(container)[0] ?? container;
      target.focus();
    };

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = focusableElements(container);
      const first = focusable[0] ?? container;
      const last = focusable[focusable.length - 1] ?? container;
      const current = document.activeElement;

      if (!container.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus, true);
    focusInitial();

    return () => {
      document.removeEventListener('keydown', trapFocus, true);
      restoreIsolation();
      const returnTarget = returnFocusRef?.current ?? fallbackReturnTarget;
      // React removes a sibling's `inert` attribute after layout-effect cleanup.
      // Restore focus in the following microtask so the target is interactive.
      queueMicrotask(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    };
  }, [active, containerRef, initialFocusRef, isolateOutside, returnFocusRef]);
};
