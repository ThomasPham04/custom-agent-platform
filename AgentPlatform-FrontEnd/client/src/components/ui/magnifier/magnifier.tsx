interface MagnifierProps {
  className?: string;
}

/**
 * The app's one magnifier. Drawn rather than typed, for the same reason as
 * `Chevron`: the UI font stack has no dependable glyph for it, and a substituted
 * one sits at the wrong size and baseline.
 *
 * Stroke geometry matches the chevron — 1.4 units on a small viewBox, round
 * caps — so the two marks read as the same hand.
 */
export const Magnifier = ({ className }: MagnifierProps) => (
  <svg
    className={className}
    viewBox="0 0 14 14"
    width="14"
    height="14"
    aria-hidden="true"
    focusable="false"
  >
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="6" cy="6" r="4.25" />
      <path d="M9.2 9.2L12.5 12.5" />
    </g>
  </svg>
);
