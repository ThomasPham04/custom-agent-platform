import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Chevron } from './chevron';
import { AgentSwitcher } from '../../chat-section/agent-switcher/agent-switcher';
import { Sidebar } from '../../layout/Sidebar';

// The sidebar reads the shared session list, which throws outside its provider.
// This file is about the chevron, so the list is stubbed empty rather than run.
vi.mock('../../../hooks/useSessions', () => ({
  useSessionsContext: () => ({
    sessions: [],
    loading: false,
    rename: vi.fn(),
    remove: vi.fn(),
    adopt: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Same reasoning: the sidebar also reads the walkthrough context, which throws
// outside its provider. This file is about the chevron, not the walkthrough.
vi.mock('../../../hooks/useWalkthrough', () => ({
  useWalkthroughContext: () => ({
    active: null,
    index: 0,
    step: null,
    catalog: [],
    start: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    skip: vi.fn(),
  }),
}));

/**
 * U+2304 is missing from the UI font stack, so the browser substituted whatever
 * font had it — a small "v" sitting below the baseline. Every chevron is drawn
 * now, and this pins the two that used the glyph.
 */
describe('Chevron', () => {
  it('draws a path rather than typing a character', () => {
    const { container } = render(<Chevron />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('path')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('is decorative, so assistive tech skips it', () => {
    const { container } = render(<Chevron />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('chevrons in place', () => {
  it('draws the agent switcher chevron', () => {
    const { container } = render(
      <AgentSwitcher agents={[]} selected={null} onSelect={() => {}} />,
    );
    const chevron = container.querySelector('.agent-switcher__chevron');
    expect(chevron?.querySelector('svg path')).not.toBeNull();
    expect(chevron?.textContent).toBe('');
  });

  it('draws the sidebar workspace chevron', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar agents={[]} open onClose={() => {}} />
      </MemoryRouter>,
    );
    const chevron = container.querySelector('.sidebar__chevron');
    expect(chevron?.querySelector('svg path')).not.toBeNull();
    expect(chevron?.textContent).toBe('');
  });
});
