import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './chip';

/** The tone lives on the chip; getByText returns its inner label span. */
const chipFor = (text: string) => screen.getByText(text).closest('.chip');

describe('Chip', () => {
  it('defaults to the neutral tone', () => {
    render(<Chip>gemini-3.1-flash-lite</Chip>);
    expect(chipFor('gemini-3.1-flash-lite')).toHaveClass('chip--neutral');
  });

  it('carries the trace tone for tool chips', () => {
    render(<Chip tone="trace">current_time</Chip>);
    expect(chipFor('current_time')).toHaveClass('chip--trace');
  });

  it('renders no remove control unless onRemove is given', () => {
    render(<Chip tone="trace">current_time</Chip>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a labelled remove control and reports clicks', async () => {
    const onRemove = vi.fn();
    render(
      <Chip tone="trace" onRemove={onRemove} removeLabel="Remove current_time">
        current_time
      </Chip>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove current_time' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
