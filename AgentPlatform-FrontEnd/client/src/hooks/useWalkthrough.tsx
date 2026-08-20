import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Spotlight } from '../components/ui/spotlight';
import { WALKTHROUGHS } from '../data/walkthroughs';
import type { SpotlightRect } from '../lib/spotlight-position';
import type { Walkthrough, WalkthroughStep } from '../types/walkthrough';

export const WALKTHROUGH_SEEN_KEY = 'agentPlatform.walkthroughSeen';

/** How long to keep looking for a target before accepting that it is absent. */
const TARGET_TIMEOUT_MS = 1000;

interface WalkthroughApi {
  active: Walkthrough | null;
  index: number;
  step: WalkthroughStep | null;
  catalog: readonly Walkthrough[];
  start: (id: string) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

interface Measurement {
  rect: SpotlightRect | null;
  radius?: string;
  /** True while the element is still being looked for. */
  pending: boolean;
}

const ABSENT: Measurement = { rect: null, pending: false };

const measure = (element: HTMLElement, rect: DOMRect): Measurement => ({
  rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
  radius: getComputedStyle(element).borderRadius,
  pending: false,
});

/**
 * A resolved element the user cannot actually see is worse than no target at
 * all: a narrow-viewport drawer is closed but still in the DOM, translated
 * off-screen. Treat that the same as "not found" so the step degrades to the
 * centered card instead of spotlighting a hole no one can see.
 *
 * Deliberately NOT an `[inert]`-ancestor check, despite that being the
 * original suggestion: `isolateOutside` (I1) marks the entire app inert for
 * as long as any walkthrough is active, so EVERY real target — reachable or
 * not — sits inside an inert subtree the whole time. Disqualifying on that
 * basis misclassified every ordinary, visible target as unreachable (caught
 * by the existing "walks forward and back through the steps" test, which
 * regressed against this exact check during development). The geometry
 * check below is the only signal that is actually independent of the
 * walkthrough's own bookkeeping, and it already covers the measured case:
 * a closed drawer at `left: -240` with its usual width lands at `right: 0`,
 * which fails `right > 0` below.
 */
const isReachable = (rect: DOMRect): boolean => {
  if (rect.width <= 0 || rect.height <= 0) return false;
  return (
    rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight
  );
};

/**
 * Resolves a step's target and keeps its rect current.
 *
 * The retry loop is not defensive padding: a step that changes route advances
 * before the new route has painted, so the first query always misses.
 */
const useTargetRect = (selector: string | undefined): Measurement => {
  const [measurement, setMeasurement] = useState<Measurement>(ABSENT);

  /*
    Layout effect, not effect: this must land before the browser paints. A
    plain effect leaves the PREVIOUS step's stale measurement on screen for
    one committed frame after `selector` has already changed underneath it —
    a card painted over the wrong hole (or over none at all) before jumping
    to the right place. Layout effects run before paint, so React collapses
    that stale frame away instead of ever showing it.
  */
  useLayoutEffect(() => {
    if (!selector) {
      setMeasurement(ABSENT);
      return;
    }

    setMeasurement({ rect: null, pending: true });

    let frame = 0;
    let element: HTMLElement | null = null;
    let observer: ResizeObserver | undefined;
    const deadline = Date.now() + TARGET_TIMEOUT_MS;

    const remeasure = () => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (!isReachable(rect)) {
        setMeasurement(ABSENT);
        return;
      }
      setMeasurement(measure(element, rect));
    };

    const resolve = () => {
      const found = document.querySelector<HTMLElement>(`[data-walkthrough="${selector}"]`);
      element = found && isReachable(found.getBoundingClientRect()) ? found : null;

      if (!element) {
        if (Date.now() < deadline) {
          frame = requestAnimationFrame(resolve);
          return;
        }
        // Ordinary, not exceptional: TraceRail and Composer both unmount,
        // and a narrow-viewport drawer can be closed for the whole step.
        setMeasurement(ABSENT);
        return;
      }

      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      remeasure();

      observer = new ResizeObserver(remeasure);
      observer.observe(element);
      window.addEventListener('resize', remeasure);
      /*
        Capture phase: the agents table and the message list scroll inside the
        workspace rather than on window, and a bubbling listener never hears them.
      */
      window.addEventListener('scroll', remeasure, true);
    };

    resolve();

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [selector]);

  return measurement;
};

const WalkthroughContext = createContext<WalkthroughApi | null>(null);

export const useWalkthroughContext = (): WalkthroughApi => {
  const api = useContext(WalkthroughContext);
  if (!api) throw new Error('useWalkthroughContext must be called inside a WalkthroughProvider.');
  return api;
};

export const WalkthroughProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<Walkthrough | null>(null);
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const step = active ? (active.steps[index] ?? null) : null;
  const target = useTargetRect(step?.target);

  /*
    Where to return the user when this ends. Tracked only while nothing is
    running, so it holds the last place they chose rather than a place the
    walkthrough took them.
  */
  const returnTo = useRef(location.pathname);
  useEffect(() => {
    if (!active) returnTo.current = location.pathname;
  }, [active, location.pathname]);

  /*
    Where to return focus when this ends. Captured once, at start(), rather
    than relying on useModalFocus's own document.activeElement fallback:
    `key={step.id}` remounts the card every step, so that fallback would
    only ever see the PREVIOUS step's forward button — already disconnected
    by the time the walkthrough actually stops.
  */
  const startFocusTarget = useRef<HTMLElement | null>(null);

  const start = useCallback((id: string) => {
    const found = WALKTHROUGHS.find((walkthrough) => walkthrough.id === id);
    if (!found) return;
    startFocusTarget.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActive(found);
    setIndex(0);
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
  }, []);

  const stop = useCallback(() => {
    setActive(null);
    setIndex(0);
    navigate(returnTo.current);
  }, [navigate]);

  // Runs after the overlay has actually unmounted (and, in turn, after its own
  // cleanup has lifted isolation), so the target is interactive again by the
  // time focus lands on it.
  useEffect(() => {
    if (active) return;
    const target = startFocusTarget.current;
    startFocusTarget.current = null;
    if (target?.isConnected) target.focus();
  }, [active]);

  const next = useCallback(() => {
    if (!active) return;
    if (index + 1 >= active.steps.length) {
      stop();
      return;
    }
    setIndex(index + 1);
  }, [active, index, stop]);

  const prev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  // Route first, measure second. The step names where it belongs; getting there
  // is the engine's job, not the step's.
  useEffect(() => {
    if (!step?.route || location.pathname === step.route) return;
    navigate(step.route);
  }, [step, location.pathname, navigate]);

  /*
    Fires once. start() writes the flag, so StrictMode's second invocation in
    development finds it already set and does nothing.
  */
  useEffect(() => {
    if (localStorage.getItem(WALKTHROUGH_SEEN_KEY)) return;
    start('overview');
  }, [start]);

  const api = useMemo(
    () => ({
      active,
      index,
      step,
      catalog: WALKTHROUGHS,
      start,
      next,
      prev,
      skip: stop,
    }),
    [active, index, step, start, next, prev, stop],
  );

  return (
    <WalkthroughContext.Provider value={api}>
      {children}
      {/*
        Mounted for the whole time a walkthrough is active, pending target or
        not: the dim and the focus trap must never drop, or the page beneath
        goes interactive mid-walkthrough. `pending` tells Spotlight to render
        only the scrim while the target is still being looked for, so no card
        ever paints centered (or over the wrong hole) before jumping to its
        element. The key remounts the overlay each step, which restarts the
        ring's pulse and moves focus to the forward action once it resolves.
      */}
      {active && step && (
        <Spotlight
          key={step.id}
          step={step}
          index={index}
          total={active.steps.length}
          pending={target.pending}
          targetRect={target.rect}
          targetRadius={target.radius}
          onNext={next}
          onPrev={prev}
          onSkip={stop}
        />
      )}
    </WalkthroughContext.Provider>
  );
};
