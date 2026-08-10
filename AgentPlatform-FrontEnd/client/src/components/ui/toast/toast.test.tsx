import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './toast';

const Trigger = ({ message }: { message: string }) => {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message)}>
      Show
    </button>
  );
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const clickShow = () => act(() => screen.getByRole('button', { name: 'Show' }).click());

describe('ToastProvider', () => {
  it('exposes a polite live region even before anything is shown', () => {
    render(
      <ToastProvider>
        <Trigger message="Agent deleted" />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows a message and dismisses it after four seconds', () => {
    render(
      <ToastProvider>
        <Trigger message="Agent deleted" />
      </ToastProvider>,
    );

    clickShow();
    expect(screen.getByText('Agent deleted')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByText('Agent deleted')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Agent deleted')).not.toBeInTheDocument();
  });

  it('replaces the current toast rather than stacking', () => {
    const Two = () => {
      const { show } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            show('First');
            show('Second');
          }}
        >
          Show
        </button>
      );
    };
    render(
      <ToastProvider>
        <Two />
      </ToastProvider>,
    );

    clickShow();
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('names the error when used outside a provider', () => {
    expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
  });
});
