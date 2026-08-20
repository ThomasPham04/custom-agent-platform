import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Spotlight } from './spotlight';
import type { WalkthroughStep } from '../../../types/walkthrough';

const step: WalkthroughStep = {
  id: 'create:new',
  title: 'New agent opens a blank draft',
  body: 'Name it, pick a model, choose the tools it may use, then save.',
  target: 'agents-new',
  placement: 'bottom',
};

const rect = { top: 100, left: 100, width: 120, height: 32 };

const renderSpotlight = (props: Partial<Parameters<typeof Spotlight>[0]> = {}) => {
  const handlers = { onNext: vi.fn(), onPrev: vi.fn(), onSkip: vi.fn() };
  render(
    <Spotlight
      step={step}
      index={1}
      total={5}
      targetRect={rect}
      targetRadius="3px"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('Spotlight', () => {
  it('states the step, its substance, and where you are in the sequence', () => {
    renderSpotlight();
    expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument();
    expect(screen.getByText(step.body)).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('is a modal dialog labelled by its own title', () => {
    renderSpotlight();
    expect(screen.getByRole('dialog', { name: step.title })).toHaveAttribute('aria-modal', 'true');
  });

  it('advances and retreats', async () => {
    const { onNext, onPrev } = renderSpotlight();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('has nowhere to go back to on the first step', () => {
    renderSpotlight({ index: 0 });
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('offers Done rather than Next on the last step', () => {
    renderSpotlight({ index: 4 });
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('skips from the corner control', async () => {
    const { onSkip } = renderSpotlight();
    await userEvent.click(screen.getByRole('button', { name: 'Skip walkthrough' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('skips on Escape, the way every other overlay here does', async () => {
    const { onSkip } = renderSpotlight();
    await userEvent.keyboard('{Escape}');
    expect(onSkip).toHaveBeenCalledOnce();
  });

  // TraceRail and Composer both unmount under ordinary conditions. A step that
  // cannot find its target still has something to say.
  it('centers itself when the target could not be found', () => {
    renderSpotlight({ targetRect: null });
    expect(screen.getByRole('dialog')).toHaveClass('spotlight--centered');
    expect(screen.getByText(step.body)).toBeInTheDocument();
  });

  it('starts with the forward action focused', () => {
    renderSpotlight();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
  });

  // spotlightPosition() also returns which side won (`placement`); the style
  // prop's type only promises top/left, and the DOM should hold only what
  // the type promises.
  it('does not leak the placement field spotlightPosition returns into the DOM', () => {
    renderSpotlight();
    const style = screen.getByRole('dialog').querySelector('.spotlight__card')?.getAttribute('style');
    expect(style).not.toMatch(/placement/);
  });

  describe('while the target is still pending', () => {
    it('renders the scrim, with no cutout and no card', () => {
      renderSpotlight({ pending: true });
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('spotlight--pending');
      expect(dialog.querySelector('.spotlight__cutout')).not.toBeInTheDocument();
      expect(dialog.querySelector('.spotlight__card')).not.toBeInTheDocument();
      expect(screen.queryByText(step.title)).not.toBeInTheDocument();
    });

    it('still traps focus inside the overlay', () => {
      renderSpotlight({ pending: true });
      expect(screen.getByRole('dialog')).toHaveFocus();
    });
  });
});
