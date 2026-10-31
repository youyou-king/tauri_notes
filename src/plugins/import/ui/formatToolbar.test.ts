import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import type { EditorToolbarSnapshot } from "../../../application/state/editorSnapshot";
import { createFormatToolbarItems } from "./formatToolbar";

const toolbar: EditorToolbarSnapshot = {
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
  canRedo: true,
};

function editor(link = ""): Editor {
  return {
    getAttributes: () => ({ href: link }),
  } as unknown as Editor;
}

describe("format toolbar items", () => {
  it("maps undo/redo availability from the snapshot", () => {
    const items = createFormatToolbarItems(
      editor(),
      toolbar,
      vi.fn(),
      vi.fn(),
    );
    expect(items).toHaveLength(15);
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(false);
  });

  it("runs the table and link callbacks", () => {
    const insertTable = vi.fn();
    const openLink = vi.fn();
    const items = createFormatToolbarItems(
      editor("https://example.com"),
      toolbar,
      insertTable,
      openLink,
    );
    items[13].run();
    items[14].run();
    expect(insertTable).toHaveBeenCalledOnce();
    expect(openLink).toHaveBeenCalledWith("https://example.com");
  });

  it("marks active formatting flags", () => {
    const items = createFormatToolbarItems(
      editor(),
      { ...toolbar, bold: true, headingLevel: 2 },
      vi.fn(),
      vi.fn(),
    );
    expect(items[2].active).toBe("bold");
    expect(items[7].active).toEqual({ headingLevel: 2 });
  });
});
