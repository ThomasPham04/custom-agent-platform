interface ChevronProps {
  className?: string;
}

/**
 * The app's one chevron. Drawn rather than typed: U+2304 is absent from the UI
 * font stack, so the browser substituted a font that had it and the glyph came
 * out small and below the baseline.
 *
 * The geometry matches the arrow `select.css` paints as a background image —
 * they are the same mark on the same kind of control, so they must not drift.
 */
export const Chevron = ({ className }: ChevronProps) => (
  <svg
    className={className}
    viewBox="0 0 10 6"
    width="10"
    height="6"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M1 1l4 4 4-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
