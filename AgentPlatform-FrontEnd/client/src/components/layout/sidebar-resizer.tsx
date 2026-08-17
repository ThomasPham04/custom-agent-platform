import './sidebar-resizer.css';

export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 420;
/** Matches --sidebar-width in tokens.css, so a reset lands back on the default. */
export const SIDEBAR_WIDTH_DEFAULT = 240;

export const clampSidebarWidth = (width: number) =>
  Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(width)));

const STEP = 16;

interface SidebarResizerProps {
  width: number;
  onResize: (width: number) => void;
}

/**
 * The drag handle for the sidebar's width.
 *
 * It sits in the shell as the sidebar's sibling rather than inside it: the
 * sidebar scrolls, so a handle within it would scroll away from the edge it is
 * supposed to sit on. As a flex item it is full height for free.
 */
export const SidebarResizer = ({ width, onResize }: SidebarResizerProps) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize sidebar"
    aria-valuenow={width}
    aria-valuemin={SIDEBAR_WIDTH_MIN}
    aria-valuemax={SIDEBAR_WIDTH_MAX}
    tabIndex={0}
    className="sidebar-resizer"
    // Pointer capture keeps the drag alive when the pointer outruns this 6px
    // strip, which it does immediately.
    onPointerDown={(event) => {
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      // The sidebar is flush against the left edge, so the pointer's x is the
      // width it is asking for.
      onResize(clampSidebarWidth(event.clientX));
    }}
    onPointerUp={(event) => {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    // A handle this thin is easy to miss by a pixel; double-click restores the
    // default rather than leaving someone to hunt for it.
    onDoubleClick={() => onResize(SIDEBAR_WIDTH_DEFAULT)}
    onKeyDown={(event) => {
      if (event.key === 'ArrowLeft') onResize(clampSidebarWidth(width - STEP));
      else if (event.key === 'ArrowRight') onResize(clampSidebarWidth(width + STEP));
      else if (event.key === 'Home') onResize(SIDEBAR_WIDTH_MIN);
      else if (event.key === 'End') onResize(SIDEBAR_WIDTH_MAX);
      else return;
      // Arrow keys would otherwise scroll the page under the handle.
      event.preventDefault();
    }}
  />
);
