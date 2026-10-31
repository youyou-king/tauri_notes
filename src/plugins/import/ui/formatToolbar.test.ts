import { describe, expect, it } from "vitest";
import { isFormatActive } from "./formatToolbar";

function editorAtHeading(level: number) {
  return {
    isActive: (type: string, attrs?: Record<string, unknown>) =>
      type === "heading" && attrs?.level === level,
  };
}

describe("isFormatActive", () => {
  it("distinguishes H1 from H2", () => {
    const h1 = editorAtHeading(1);
    expect(
      isFormatActive(h1, { type: "heading", attrs: { level: 1 } }),
    ).toBe(true);
    expect(
      isFormatActive(h1, { type: "heading", attrs: { level: 2 } }),
    ).toBe(false);
  });

  it("still supports attribute-less marks", () => {
    const editor = {
      isActive: (type: string) => type === "bold",
    };
    expect(isFormatActive(editor, "bold")).toBe(true);
    expect(isFormatActive(editor, "italic")).toBe(false);
    expect(isFormatActive(editor, undefined)).toBe(false);
  });
});
