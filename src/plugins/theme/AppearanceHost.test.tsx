import { describe, expect, it } from "vitest";
import { isDecorationVisible } from "./AppearanceHost";
import type { DecorationAppearance } from "./appearanceApplier";

function decoration(
  hideBelow?: number,
): DecorationAppearance {
  return {
    src: "blob:x",
    anchor: "bottom-left",
    width: "22vw",
    opacity: 1,
    hideBelow,
  };
}

describe("isDecorationVisible", () => {
  it("shows decorations without a threshold", () => {
    expect(isDecorationVisible(decoration(), 320)).toBe(true);
  });

  it("hides decorations below the threshold", () => {
    expect(isDecorationVisible(decoration(900), 700)).toBe(false);
    expect(isDecorationVisible(decoration(900), 1000)).toBe(true);
  });
});
