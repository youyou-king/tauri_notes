import { describe, expect, it } from "vitest";
import { shouldHighlightBlock } from "./selectionHighlight";

describe("shouldHighlightBlock", () => {
  it("leaves ordinary text blocks to the native text selection", () => {
    expect(
      shouldHighlightBlock({
        isAtom: false,
        type: { name: "paragraph" },
      }),
    ).toBe(false);
    expect(
      shouldHighlightBlock({
        isAtom: false,
        type: { name: "heading" },
      }),
    ).toBe(false);
    expect(
      shouldHighlightBlock({
        isAtom: false,
        type: { name: "bulletList" },
      }),
    ).toBe(false);
  });

  it("keeps a block tint for cards and code blocks", () => {
    expect(
      shouldHighlightBlock({
        isAtom: true,
        type: { name: "viewportBlock" },
      }),
    ).toBe(true);
    expect(
      shouldHighlightBlock({
        isAtom: false,
        type: { name: "codeBlock" },
      }),
    ).toBe(true);
    expect(
      shouldHighlightBlock({
        isAtom: true,
        type: { name: "tableBlock" },
      }),
    ).toBe(true);
  });
});
