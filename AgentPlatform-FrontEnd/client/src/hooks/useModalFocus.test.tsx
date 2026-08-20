import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useModalFocus } from "./useModalFocus";

/**
 * A stand-in for the shell: a sidebar the app drives, and a workspace holding
 * the panel that isolates itself. `active` is the sheet breakpoint.
 */
const Shell = ({
  active,
  sidebarInert,
}: {
  active: boolean;
  sidebarInert: boolean;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus({ active, containerRef: panelRef, isolateOutside: true });

  return (
    <div>
      <nav data-testid="sidebar" inert={sidebarInert ? true : undefined}>
        <button type="button">Agents</button>
      </nav>
      <main>
        <div data-testid="list">
          <button type="button">A document</button>
        </div>
        <div data-testid="panel" ref={panelRef}>
          <button type="button">Close</button>
        </div>
      </main>
    </div>
  );
};

describe("useModalFocus isolation", () => {
  it("shuts the rest of the page out while the panel is modal", () => {
    render(<Shell active sidebarInert={false} />);

    expect(screen.getByTestId("sidebar")).toHaveAttribute("inert");
    expect(screen.getByTestId("list")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("panel")).not.toHaveAttribute("inert");
  });

  it("lets the page back in when the panel stops being modal", () => {
    const { rerender } = render(<Shell active sidebarInert={false} />);
    rerender(<Shell active={false} sidebarInert={false} />);

    expect(screen.getByTestId("sidebar")).not.toHaveAttribute("inert");
    expect(screen.getByTestId("list")).not.toHaveAttribute("aria-hidden");
  });

  /*
    The regression this pair exists for. The sidebar is inert on its own account
    below 700px, where it is a closed drawer. Widening the window while a sheet
    is open ends both at once: the drawer becomes a sidebar again and the sheet
    becomes a column. If closing the isolation writes back the `inert` it saw on
    the way in, it reinstates one React has already dropped, and the sidebar is
    dead to the mouse and the keyboard until the page is reloaded.
  */
  it("leaves an inert the app set alone rather than adopting it", () => {
    render(<Shell active sidebarInert />);

    expect(screen.getByTestId("sidebar")).toHaveAttribute("inert");
  });

  it("does not reinstate an inert the app has since dropped", () => {
    const { rerender } = render(<Shell active sidebarInert />);
    // Both change together: no longer a drawer, no longer a sheet.
    rerender(<Shell active={false} sidebarInert={false} />);

    expect(screen.getByTestId("sidebar")).not.toHaveAttribute("inert");
  });
});
