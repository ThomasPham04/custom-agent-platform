export type SpotlightPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface WalkthroughStep {
  /** Stable across edits: the React key, and the handle tests address. */
  id: string;
  title: string;
  body: string;
  /**
   * Value of the data-walkthrough attribute on the element to cut out of the
   * dim. Absent means a centered card about the screen as a whole.
   */
  target?: string;
  /** Route the app must be on before this step measures anything. */
  route?: string;
  /** Preferred side. spotlightPosition flips it when it would overflow. */
  placement?: SpotlightPlacement;
}

export interface Walkthrough {
  id: string;
  /** Shown in the sidebar picker. */
  name: string;
  /** One line under the name in the picker. */
  summary: string;
  steps: readonly WalkthroughStep[];
}
