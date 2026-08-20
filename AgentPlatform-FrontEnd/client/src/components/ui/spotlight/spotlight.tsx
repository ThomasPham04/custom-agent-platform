import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '../../../hooks/useModalFocus';
import { spotlightPosition, type SpotlightRect } from '../../../lib/spotlight-position';
import type { WalkthroughStep } from '../../../types/walkthrough';
import './spotlight.css';

/** Breathing room between the target's own edge and the hole cut around it. */
const CUTOUT_PADDING = 6;

interface SpotlightProps {
  step: WalkthroughStep;
  index: number;
  total: number;
  /**
   * True while the target is still being looked for. While pending, only the
   * scrim (and the focus trap behind it) renders — no cutout, no card — so a
   * card is never painted centered and then moved to a target within the
   * same step. Defaults to false for callers with an already-resolved rect.
   */
  pending?: boolean;
  /** Null when the target could not be resolved: the card centers instead. */
  targetRect: SpotlightRect | null;
  /** Copied from the target so a pill button gets a pill hole. */
  targetRadius?: string;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export const Spotlight = ({
  step,
  index,
  total,
  pending = false,
  targetRect,
  targetRadius,
  onNext,
  onPrev,
  onSkip,
}: SpotlightProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const titleId = `spotlight-title-${step.id}`;
  const last = index === total - 1;

  /*
    Layout effect, not effect: this runs before the browser paints, so the card
    never appears at 0,0 and then jumps. Same reasoning as Popover.
  */
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !targetRect) {
      setPosition(null);
      return;
    }
    // spotlightPosition() also returns `placement` (which side won); the card
    // only ever needs where it sits.
    const { top, left } = spotlightPosition({
      target: targetRect,
      card: { width: card.offsetWidth, height: card.offsetHeight },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      placement: step.placement ?? 'bottom',
    });
    setPosition({ top, left });
  }, [step.placement, targetRect]);

  /*
    Capture phase, so the walkthrough claims Escape before anything beneath it.
    A popover the user left open would otherwise answer first.
  */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onSkip();
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onSkip]);

  /*
    Portalled to body, so isolating siblings marks #root inert and aria-hidden:
    exactly right for an overlay that blocks the page, and it reuses the
    attribute bookkeeping and focus return that hook already does. The
    container is the whole overlay, not just the card: the card (and its
    initialFocusRef target) does not exist yet while `pending` is true, and
    the trap has to hold the page hostage from the moment it mounts, not from
    whenever the target happens to resolve.
  */
  useModalFocus({
    active: true,
    containerRef: overlayRef,
    initialFocusRef: nextRef,
    isolateOutside: true,
  });

  /*
    useModalFocus only assigns initial focus once, on mount — and while
    `pending` is true there is no card yet, so it falls back to the overlay
    itself. Once the target resolves and the card (and its Next button)
    appear in the same mounted instance, move focus there explicitly.
  */
  useLayoutEffect(() => {
    if (!pending) nextRef.current?.focus();
  }, [pending]);

  const resolved = !pending;
  const centered = resolved && !targetRect;

  return createPortal(
    <div
      ref={overlayRef}
      className={['spotlight', pending ? 'spotlight--pending' : centered ? 'spotlight--centered' : '']
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={resolved ? titleId : undefined}
      aria-label={pending ? 'Walkthrough step loading' : undefined}
      tabIndex={-1}
    >
      {resolved && targetRect && (
        <span
          className="spotlight__cutout"
          aria-hidden="true"
          style={{
            top: targetRect.top - CUTOUT_PADDING,
            left: targetRect.left - CUTOUT_PADDING,
            width: targetRect.width + CUTOUT_PADDING * 2,
            height: targetRect.height + CUTOUT_PADDING * 2,
            borderRadius: targetRadius,
          }}
        />
      )}

      {resolved && (
        <div ref={cardRef} className="spotlight__card" style={position ?? undefined}>
          <button
            type="button"
            className="spotlight__skip"
            aria-label="Skip walkthrough"
            onClick={onSkip}
          >
            <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" focusable="false">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <h2 id={titleId} className="spotlight__title">
            {step.title}
          </h2>
          <p className="spotlight__body">{step.body}</p>

          <div className="spotlight__foot">
            {/* A counter is machine data, and this app sets machine data in mono. */}
            <span className="spotlight__count mono">
              Step {index + 1} of {total}
            </span>
            <div className="spotlight__actions">
              <button
                type="button"
                className="spotlight__button"
                disabled={index === 0}
                onClick={onPrev}
              >
                Previous
              </button>
              <button
                ref={nextRef}
                type="button"
                className="spotlight__button spotlight__button--primary"
                onClick={onNext}
              >
                {last ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};
