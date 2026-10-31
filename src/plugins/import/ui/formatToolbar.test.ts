import { describe, expect, it } from "vitest";
import type { EditorToolbarSnapshot } from "../../../application/state/editorSnapshot";
import { isFormatActive } from "./formatToolbar";

function toolbar(
  patch: Partial<EditorToolbarSnapshot> = {},
): EditorToolbarSnapshot {
  return {
    bold: false,
    italic: false,
    strike: false,
    code: false,
    headingLevel: 0,
    bulletList: false,
    taskList: false,
    blockquote: false,
    codeBlock: false,
    tableBlock: false,
    link: false,
    canUndo: false,
    canRedo: false,
    ...patch,
  };
}

describe("isFormatActive", () => {
  it("distinguishes H1 from H2", () => {
    const h1 = toolbar({ headingLevel: 1 });
    expect(isFormatActive(h1, { headingLevel: 1 })).toBe(true);
    expect(isFormatActive(h1, { headingLevel: 2 })).toBe(false);
  });

  it("supports attribute-less marks", () => {
    expect(isFormatActive(toolbar({ bold: true }), "bold")).toBe(true);
    expect(isFormatActive(toolbar(), "italic")).toBe(false);
    expect(isFormatActive(toolbar(), undefined)).toBe(false);
  });
});
