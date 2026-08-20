import type { SpotlightPlacement } from '../types/walkthrough';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

export interface SpotlightPositionArgs {
  target: SpotlightRect;
  card: Size;
  viewport: Size;
  placement: SpotlightPlacement;
}

export interface SpotlightPositionResult {
  top: number;
  left: number;
  placement: SpotlightPlacement;
}

/** Distance between the cutout edge and the card. */
export const SPOTLIGHT_GAP = 12;
/** Smallest distance the card keeps from any viewport edge. */
export const SPOTLIGHT_MARGIN = 8;

const OPPOSITE: Record<SpotlightPlacement, SpotlightPlacement> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

const fits = (placement: SpotlightPlacement, { target, card, viewport }: SpotlightPositionArgs) => {
  switch (placement) {
    case 'top':
      return target.top - SPOTLIGHT_GAP - card.height >= SPOTLIGHT_MARGIN;
    case 'bottom':
      return (
        target.top + target.height + SPOTLIGHT_GAP + card.height <=
        viewport.height - SPOTLIGHT_MARGIN
      );
    case 'left':
      return target.left - SPOTLIGHT_GAP - card.width >= SPOTLIGHT_MARGIN;
    case 'right':
      return (
        target.left + target.width + SPOTLIGHT_GAP + card.width <= viewport.width - SPOTLIGHT_MARGIN
      );
  }
};

const place = (placement: SpotlightPlacement, { target, card }: SpotlightPositionArgs) => {
  const centreX = target.left + target.width / 2 - card.width / 2;
  const centreY = target.top + target.height / 2 - card.height / 2;

  switch (placement) {
    case 'top':
      return { top: target.top - SPOTLIGHT_GAP - card.height, left: centreX };
    case 'bottom':
      return { top: target.top + target.height + SPOTLIGHT_GAP, left: centreX };
    case 'left':
      return { top: centreY, left: target.left - SPOTLIGHT_GAP - card.width };
    case 'right':
      return { top: centreY, left: target.left + target.width + SPOTLIGHT_GAP };
  }
};

/**
 * Resolves where the card sits. The requested side wins when it fits; the
 * opposite side is the only fallback, because a target that crowds the top also
 * crowds the bottom only when it is taller than the viewport, and in that case
 * clamping reads better than sliding the card somewhere unrelated.
 */
export const spotlightPosition = (args: SpotlightPositionArgs): SpotlightPositionResult => {
  const placement = fits(args.placement, args)
    ? args.placement
    : fits(OPPOSITE[args.placement], args)
      ? OPPOSITE[args.placement]
      : args.placement;

  const { top, left } = place(placement, args);

  return {
    placement,
    top: clamp(top, SPOTLIGHT_MARGIN, args.viewport.height - args.card.height - SPOTLIGHT_MARGIN),
    left: clamp(left, SPOTLIGHT_MARGIN, args.viewport.width - args.card.width - SPOTLIGHT_MARGIN),
  };
};
