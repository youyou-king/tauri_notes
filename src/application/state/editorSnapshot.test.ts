import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import {
  editorSnapshot,
  selectedBlockAtSelection,
  type EditorToolbarSnapshot,
} from "./editorSnapshot";

function fakeEditor(
  options: {
    from?: number;
    headingLevel?: number;
    active?: Partial<EditorToolbarSnapshot>;
    canUndo?: boolean;
    canRedo?: boolean;
  } = {},
): Editor {
  const blocks = [
    {
      type: { name: "paragraph" },
      attrs: { span: 12, heightMode: "auto" },
      nodeSize: 6,
    },
    {
      type: { name: "heading" },
      attrs: { span: 12, heightMode: "auto", level: options.headingLevel ?? 1 },
      nodeSize: 8,
    },
  ];
  const doc = {
    childCount: blocks.length,
    textContent: "abc",
    forEach: (
      callback: (node: (typeof blocks)[number], offset: number) => void,
    ) => {
      let offset = 0;
      for (const block of blocks) {
        callback(block, offset);
        offset += block.nodeSize;
      }
    },
  };
  const flags = options.active ?? {};
  return {
    state: {
      selection: { from: options.from ?? 7 },
      doc,
    },
    isActive: (type: string, attrs?: Record<string, unknown>) => {
      if (type === "heading") {
        return attrs?.level === (options.headingLevel ?? 1);
      }
      return Boolean(flags[type as keyof EditorToolbarSnapshot]);
    },
    can: () => ({
      undo: () => options.canUndo ?? false,
      redo: () => options.canRedo ?? false,
    }),
  } as unknown as Editor;
}

describe("editorSnapshot", () => {
  it("derives selected block, stats and toolbar from one snapshot", () => {
    const snapshot = editorSnapshot(
      fakeEditor({
        headingLevel: 1,
        active: { bold: true, link: true },
        canUndo: true,
      }),
    );

    expect(snapshot.selectedBlock?.type).toBe("heading");
    expect(snapshot.stats).toEqual({ blocks: 2, characters: 3 });
    expect(snapshot.toolbar.headingLevel).toBe(1);
    expect(snapshot.toolbar.bold).toBe(true);
    expect(snapshot.toolbar.link).toBe(true);
    expect(snapshot.toolbar.tableBlock).toBe(false);
    expect(snapshot.toolbar.canUndo).toBe(true);
    expect(snapshot.toolbar.canRedo).toBe(false);
  });

  it("returns null when the selection is outside top-level blocks", () => {
    const editor = fakeEditor({ from: 100 });
    expect(selectedBlockAtSelection(editor)).toBeNull();
  });
});
