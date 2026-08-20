import { useLayoutEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface UseModalFocusOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  isolateOutside?: boolean;
}

/** What this isolation added to one element, and therefore what it may take
    back. An attribute already present was somebody else's, and stays theirs. */
interface AddedAttributes {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: boolean;
}

/*
  Additive only: an element that already carries `inert` or `aria-hidden` is
  one the app itself is driving, so this leaves it alone and never writes a
  remembered value back on the way out.

  Saving and restoring looks equivalent and is not. React owns `inert` on the
  sidebar (closed drawer) and on the workspace (open drawer), and it can change
  its mind while a sheet is open — cross the 700px breakpoint and the sidebar
  stops being a drawer. Restoring the value captured on entry then reinstates an
  `inert` React had already removed, and the sidebar goes dead until reload.
  Nothing can flip those props from under us in the other direction, because
  every control that would is inert for as long as the isolation lasts.
*/
const isolateSiblings = (container: HTMLElement) => {
  const added: AddedAttributes[] = [];
  const seen = new Set<HTMLElement>();
  let branch: HTMLElement = container;

  while (branch.parentElement) {
    const parent = branch.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (
        !(sibling instanceof HTMLElement) ||
        sibling === branch ||
        seen.has(sibling)
      )
        continue;
      seen.add(sibling);

      const inert = !sibling.hasAttribute("inert");
      const ariaHidden = !sibling.hasAttribute("aria-hidden");
      if (inert) sibling.setAttribute("inert", "");
      if (ariaHidden) sibling.setAttribute("aria-hidden", "true");
      if (inert || ariaHidden)
        added.push({ element: sibling, inert, ariaHidden });
    }
    if (parent === document.body) break;
    branch = parent;
  }

  return () => {
    for (const { element, inert, ariaHidden } of added) {
      if (inert) element.removeAttribute("inert");
      if (ariaHidden) element.removeAttribute("aria-hidden");
    }
  };
};

const focusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.closest("[inert]"));

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
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const restoreIsolation = isolateOutside
      ? isolateSiblings(container)
      : () => {};

    const focusInitial = () => {
      const target =
        initialFocusRef?.current ??
        focusableElements(container)[0] ??
        container;
      target.focus();
    };

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
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

    document.addEventListener("keydown", trapFocus, true);
    focusInitial();

    return () => {
      document.removeEventListener("keydown", trapFocus, true);
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
