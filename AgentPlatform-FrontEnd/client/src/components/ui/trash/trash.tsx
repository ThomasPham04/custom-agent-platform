interface TrashProps {
  className?: string;
}

/**
 * The app's one trash mark, drawn to the same recipe as `Chevron` and
 * `Magnifier` — 14-unit box, 1.4 stroke, round caps — so the icons in the
 * product read as one hand rather than three imported sets.
 */
export const Trash = ({ className }: TrashProps) => (
  <svg
    className={className}
    viewBox="0 0 14 14"
    width="14"
    height="14"
    aria-hidden="true"
    focusable="false"
  >
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.2 3.7h9.6" />
      <path d="M5.6 3.7V2.6c0-.4.3-.7.7-.7h1.4c.4 0 .7.3.7.7v1.1" />
      <path d="M3.5 3.7v7.4c0 .6.4 1 1 1h5c.6 0 1-.4 1-1V3.7" />
      <path d="M5.9 6.2v3.4M8.1 6.2v3.4" />
    </g>
  </svg>
);
