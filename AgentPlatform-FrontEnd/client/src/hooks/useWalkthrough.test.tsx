import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { WALKTHROUGHS } from '../data/walkthroughs';
import { Sidebar } from '../components/layout/Sidebar';
import {
  WALKTHROUGH_SEEN_KEY,
  WalkthroughProvider,
  useWalkthroughContext,
} from './useWalkthrough';

// Only the Sidebar-focus regression test below renders the real Sidebar. It
// needs these two hooks stubbed for the same reason Sidebar.test.tsx stubs
// them: useApiHealth hits the network and useSessionsContext throws outside
// its own provider, and neither is what that test is about.
vi.mock('./useApiHealth', () => ({
  useApiHealth: () => ({ status: 'online', mode: 'mock' }),
}));
vi.mock('./useSessions', () => ({
  useSessionsContext: () => ({
    sessions: [],
    loading: false,
    rename: vi.fn(),
    remove: vi.fn(),
    adopt: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

/*
  Stand-ins for the real markers. Without them every targeted step waits out the
  full 1000ms resolution deadline, which is exactly waitFor's own default timeout
  — the suite would pass or fail on scheduling luck. walkthroughs.test.ts scans
  component files only, so these cannot stand in for a marker that was never
  added to a real component.
*/
const Markers = () => (
  <>
    {[...new Set(WALKTHROUGHS.flatMap((walkthrough) => walkthrough.steps.map((step) => step.target)))]
      .filter((target): target is string => Boolean(target))
      .map((target) => (
        <div key={target} data-walkthrough={target} />
      ))}
  </>
);

const Harness = () => {
  const { start, step, index, active } = useWalkthroughContext();
  return (
    <>
      <button type="button" onClick={() => start('overview')}>
        start overview
      </button>
      <button type="button" onClick={() => start('create-agent')}>
        start create
      </button>
      <button type="button" onClick={() => start('test-in-chat')}>
        start chat
      </button>
      <button type="button" onClick={() => start('no-such-walkthrough')}>
        start nothing
      </button>
      <span data-testid="state">{active ? `${active.id}:${index}:${step?.id}` : 'idle'}</span>
    </>
  );
};

const renderApp = (route = '/agents', includeMarkers = true) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <WalkthroughProvider>
        <Harness />
        {includeMarkers && <Markers />}
        <LocationProbe />
      </WalkthroughProvider>
    </MemoryRouter>,
  );

/*
  Every other test renders <Markers />, so the first querySelector always
  succeeds and the retry loop never runs. TraceRail and Composer unmount
  under ordinary conditions, so the path where a target genuinely never
  arrives is the one real users hit — it has to resolve to a centered card
  rather than leaving `pending` true and no overlay on screen.
*/
const renderWithoutMarkers = (route = '/agents') => renderApp(route, false);

const at = () => screen.getByTestId('location').textContent;
const state = () => screen.getByTestId('state').textContent;

/*
  Read from the catalog rather than written down here. These tests are about
  reaching the end of a walkthrough, not about how many steps it takes to get
  there, and a hardcoded count turns every added step into three unrelated
  failures.
*/
const createAgent = WALKTHROUGHS.find((walkthrough) => walkthrough.id === 'create-agent');
if (!createAgent) throw new Error('test setup: the "create-agent" walkthrough is missing.');
const lastCreateStep = `create-agent:${createAgent.steps.length - 1}:${createAgent.steps.at(-1)?.id}`;

/** Advances to the walkthrough's last step, leaving Done unpressed. */
const advanceToLastCreateStep = async () => {
  for (let i = 0; i < createAgent.steps.length - 1; i += 1) {
    await userEvent.click(screen.getByRole('button', { name: /Next|Done/ }));
  }
};

/*
  jsdom does no layout: every element reports a 0×0 rect at (0, 0) by default.
  useTargetRect now treats a zero-size rect as unreachable (I4), so without
  this stub every marker in the file above would look exactly like the
  closed, off-screen drawer the fix exists to catch. Individual tests
  override this per-element where they need a genuinely unreachable target.
*/
let rectSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  rectSpy = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(100, 100, 120, 32));
});

afterEach(() => {
  rectSpy.mockRestore();
});

describe('WalkthroughProvider', () => {
  it('opens the overview by itself the first time this browser loads the app', async () => {
    renderApp();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('An agent platform in four parts')).toBeInTheDocument();
  });

  /*
    The flag is set when the walkthrough starts, not when it finishes: a first
    run someone abandoned must not ambush them on the next reload.
  */
  it('records that it has run as soon as it starts, not when it ends', async () => {
    renderApp();
    await screen.findByRole('dialog');
    expect(localStorage.getItem(WALKTHROUGH_SEEN_KEY)).toBe('1');
  });

  it('stays out of the way once this browser has seen it', () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderApp();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('walks forward and back through the steps', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'start create' }));

    await waitFor(() => expect(state()).toBe('create-agent:0:create:nav'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(state()).toBe('create-agent:1:create:list'));
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(state()).toBe('create-agent:0:create:nav'));
  });

  it('takes the user to the surface a step is about', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderApp('/agents');
    await userEvent.click(screen.getByRole('button', { name: 'start chat' }));
    await waitFor(() => expect(at()).toBe('/chat'));
  });

  it('still shows the step when its target never appears', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderWithoutMarkers();
    await userEvent.click(screen.getByRole('button', { name: 'start chat' }));

    // The overlay itself (dialog role) is present immediately, scrim-only,
    // while the target is still pending — waiting on the dialog's mere
    // presence would no longer prove resolution. Wait on the resolved
    // content instead: past the 1000ms deadline, so waitFor's default
    // 1000ms timeout is not enough.
    await waitFor(() => expect(screen.getByText('Choose who answers')).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.getByRole('dialog')).toHaveClass('spotlight--centered');
  });

  /*
    A narrow-viewport sidebar drawer stays in the DOM, closed, translated
    entirely off-screen (Sidebar.css: `transform: translateX(-100%)`).
    `overview:sidebar` targets it directly. A resolved element nobody can
    see must degrade exactly like a target that was never found, not
    spotlight a hole off the edge of the screen.
  */
  it('degrades to the centered card when the resolved target is off-screen', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    const { container } = renderApp('/agents');

    // Only "sidebar" gets a closed-drawer rect; every other marker keeps the
    // default on-screen one from beforeEach.
    const drawer = container.querySelector('[data-walkthrough="sidebar"]');
    if (!drawer) throw new Error('test setup: "sidebar" marker missing from <Markers/>');
    drawer.getBoundingClientRect = () => new DOMRect(-240, 0, 240, 700);

    await userEvent.click(screen.getByRole('button', { name: 'start overview' }));
    await waitFor(() => expect(state()).toBe('overview:0:overview:what'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(state()).toBe('overview:1:overview:sidebar'));

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveClass('spotlight--centered'), {
      timeout: 3000,
    });
    expect(screen.getByText('Three surfaces')).toBeInTheDocument();
  });

  it('puts the user back where they were when it ends', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderApp('/agents');
    await userEvent.click(screen.getByRole('button', { name: 'start chat' }));
    await waitFor(() => expect(at()).toBe('/chat'));

    await userEvent.click(screen.getByRole('button', { name: 'Skip walkthrough' }));
    await waitFor(() => expect(at()).toBe('/agents'));
    expect(state()).toBe('idle');
  });

  /*
    key={step.id} remounts the card every step, so useModalFocus's own
    document.activeElement fallback only ever sees the PREVIOUS step's
    (already-disconnected) forward button by the time the walkthrough
    actually stops. Focus must return to the control that started it.
  */
  it('returns focus to the control that started it once the walkthrough ends, however many steps it took', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderApp();
    const starter = screen.getByRole('button', { name: 'start create' });
    await userEvent.click(starter);
    await waitFor(() => expect(state()).toBe('create-agent:0:create:nav'));

    await advanceToLastCreateStep();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(state()).toBe('idle'));
    expect(starter).toHaveFocus();
  });

  /*
    The unit-level test above proves the provider's own capture/restore is
    correct, but it starts the walkthrough from a button that never unmounts
    — it cannot catch a caller handing start() the wrong element. The real
    Sidebar does exactly that: its picker option lives inside a Popover that
    setWalkthroughOpen(false) unmounts in the same commit as the start()
    call, so document.activeElement at capture time must already be the
    persistent Walkthrough trigger, not the option button. This renders the
    real Sidebar against the real WalkthroughProvider (only the network- and
    context-dependent useApiHealth/useSessionsContext are stubbed) and drives
    it exactly as the bug report did: open the picker from the sidebar, start
    a walkthrough, then Escape to end it.
  */
  it('returns focus to the Sidebar Walkthrough trigger, not the picker option that started it', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    render(
      <MemoryRouter initialEntries={['/agents']}>
        <WalkthroughProvider>
          <Sidebar agents={[]} open onClose={() => {}} />
        </WalkthroughProvider>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Walkthrough' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: /What this is/ }));

    // "overview:what" carries no target, so the card renders centered
    // immediately — nothing to wait out before ending the walkthrough.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(trigger).toHaveFocus();
  });

  it('ends when the last step is acknowledged', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'start create' }));

    await advanceToLastCreateStep();
    await waitFor(() => expect(state()).toBe(lastCreateStep));

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(state()).toBe('idle'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('refuses to start a walkthrough that does not exist', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'start nothing' }));
    expect(state()).toBe('idle');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/*
  The whole no-mutation guarantee (I1/I2) rests on the rest of the page being
  inert while a walkthrough runs. `container` here is RTL's own wrapper div,
  appended directly to document.body — exactly the sibling relationship #root
  has with the portalled overlay in the real app, so isolateSiblings marks
  this same node.
*/
describe('WalkthroughProvider isolation contract', () => {
  it('isolates the rest of the page for the entire time a walkthrough is active, including while the first target is still pending', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    // No <Markers/>: the target search never finds its element, so the step
    // stays `pending` until the 1000ms resolution deadline elapses.
    const { container } = renderWithoutMarkers();

    expect(container).not.toHaveAttribute('inert');
    expect(container).not.toHaveAttribute('aria-hidden');

    await userEvent.click(screen.getByRole('button', { name: 'start chat' }));

    // Checked immediately, with no waitFor: the target is still pending right
    // now. An assertion that only ever passes once pending eventually clears
    // on its own would prove nothing about this moment.
    expect(container).toHaveAttribute('inert', '');
    expect(container).toHaveAttribute('aria-hidden', 'true');

    // Past the resolution deadline, once the step has degraded to its
    // centered card, isolation must still hold.
    await waitFor(() => expect(screen.getByText('Choose who answers')).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(container).toHaveAttribute('inert', '');
    expect(container).toHaveAttribute('aria-hidden', 'true');
  });

  it('lifts isolation once the walkthrough ends via Done', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    const { container } = renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'start create' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(container).toHaveAttribute('inert', '');

    await advanceToLastCreateStep();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(state()).toBe('idle'));
    expect(container).not.toHaveAttribute('inert');
    expect(container).not.toHaveAttribute('aria-hidden');
  });

  it('lifts isolation once the walkthrough ends via Escape', async () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    const { container } = renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'start create' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(container).toHaveAttribute('inert', '');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(state()).toBe('idle'));
    expect(container).not.toHaveAttribute('inert');
    expect(container).not.toHaveAttribute('aria-hidden');
  });
});
