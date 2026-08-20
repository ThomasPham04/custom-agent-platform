import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Magnifier } from './magnifier';

/**
 * Same contract as `Chevron`: the mark is drawn, not typed, so it can never be
 * substituted by a font that lacks the glyph.
 */
describe('Magnifier', () => {
  it('draws a lens and a handle rather than typing a character', () => {
    const { container } = render(<Magnifier />);
    const svg = container.querySelector('svg');
    expect(svg?.querySelector('circle')).not.toBeNull();
    expect(svg?.querySelector('path')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('is decorative, so assistive tech skips it', () => {
    const { container } = render(<Magnifier />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
