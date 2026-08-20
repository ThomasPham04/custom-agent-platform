import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Trash } from "./trash";

/**
 * Same contract as `Magnifier`: the mark is drawn, not typed, so it can never
 * be substituted by a font that lacks the glyph. It is also decorative — the
 * button around it carries the name of the thing being deleted.
 */
describe("Trash", () => {
  it("draws the can rather than typing a character", () => {
    const { container } = render(<Trash />);
    const svg = container.querySelector("svg");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(1);
    expect(container.textContent).toBe("");
  });

  it("is decorative, so assistive tech skips it", () => {
    const { container } = render(<Trash />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
