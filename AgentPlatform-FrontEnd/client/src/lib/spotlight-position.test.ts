import { describe, expect, it } from 'vitest';
import { SPOTLIGHT_GAP, SPOTLIGHT_MARGIN, spotlightPosition } from './spotlight-position';

const viewport = { width: 1000, height: 800 };
const card = { width: 320, height: 160 };

// A comfortable target in the middle of the screen: every side fits.
const middle = { top: 300, left: 400, width: 200, height: 40 };

describe('spotlightPosition', () => {
  it('honours the requested side when the card fits there', () => {
    const result = spotlightPosition({ target: middle, card, viewport, placement: 'bottom' });
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(middle.top + middle.height + SPOTLIGHT_GAP);
  });

  it('centers the card on the target across the other axis', () => {
    const result = spotlightPosition({ target: middle, card, viewport, placement: 'bottom' });
    // target centre 500, half a 320 card is 160, so the left edge lands at 340.
    expect(result.left).toBe(340);
  });

  it('flips to the opposite side when the requested one has no room', () => {
    const nearBottom = { top: 760, left: 400, width: 200, height: 30 };
    const result = spotlightPosition({ target: nearBottom, card, viewport, placement: 'bottom' });
    expect(result.placement).toBe('top');
    expect(result.top).toBe(nearBottom.top - SPOTLIGHT_GAP - card.height);
  });

  it('flips left to right just the same', () => {
    const nearLeft = { top: 300, left: 10, width: 120, height: 40 };
    const result = spotlightPosition({ target: nearLeft, card, viewport, placement: 'left' });
    expect(result.placement).toBe('right');
    expect(result.left).toBe(nearLeft.left + nearLeft.width + SPOTLIGHT_GAP);
  });

  it('clamps to the viewport margin rather than centering off screen', () => {
    const nearRightEdge = { top: 300, left: 940, width: 50, height: 40 };
    const result = spotlightPosition({ target: nearRightEdge, card, viewport, placement: 'bottom' });
    expect(result.left).toBe(viewport.width - card.width - SPOTLIGHT_MARGIN);
  });

  it('keeps the requested side and clamps when neither side fits', () => {
    const tall = { top: 0, left: 400, width: 200, height: 800 };
    const result = spotlightPosition({ target: tall, card, viewport, placement: 'bottom' });
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(viewport.height - card.height - SPOTLIGHT_MARGIN);
  });
});
