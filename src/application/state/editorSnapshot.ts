import type { Editor } from "@tiptap/core";

export type SelectedBlock = {
  pos: number;
  type: string;
  span: number;
  heightMode: "auto" | "fixed";
  heightPx: number;
  zoom: number;
};

export type EditorToolbarSnapshot = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  headingLevel: number;
  bulletList: boolean;
  taskList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  tableBlock: boolean;
  link: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

export type EditorStats = {
  blocks: number;
  characters: number;
};

export type EditorSnapshot = {
  selectedBlock: SelectedBlock | null;
  stats: EditorStats;
  toolbar: EditorToolbarSnapshot;
};

export const EMPTY_EDITOR_SNAPSHOT: EditorSnapshot = {
  selectedBlock: null,
  stats: { blocks: 0, characters: 0 },
  toolbar: {
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
  },
};

export function selectedBlockAtSelection(
  editor: Editor,
): SelectedBlock | null {
  const { from } = editor.state.selection;
  let found: SelectedBlock | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (offset <= from && from <= offset + node.nodeSize) {
      const attrs = node.attrs ?? {};
      found = {
        pos: offset,
        type: node.type.name,
        span: Math.max(1, Math.min(12, Number(attrs.span ?? 12))),
        heightMode: attrs.heightMode === "fixed" ? "fixed" : "auto",
        heightPx: Number(attrs.heightPx ?? 240),
        zoom: Math.max(50, Math.min(200, Number(attrs.zoom ?? 100))),
      };
    }
  });
  return found;
}

export function editorToolbarSnapshot(
  editor: Editor,
): EditorToolbarSnapshot {
  const headingLevel =
    ([1, 2, 3, 4, 5, 6] as const).find((level) =>
      editor.isActive("heading", { level }),
    ) ?? 0;

  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    headingLevel,
    bulletList: editor.isActive("bulletList"),
    taskList: editor.isActive("taskList"),
    blockquote: editor.isActive("blockquote"),
    codeBlock: editor.isActive("codeBlock"),
    tableBlock: editor.isActive("tableBlock"),
    link: editor.isActive("link"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
}

export function editorSnapshot(editor: Editor): EditorSnapshot {
  return {
    selectedBlock: selectedBlockAtSelection(editor),
    stats: {
      blocks: editor.state.doc.childCount,
      characters: editor.state.doc.textContent.length,
    },
    toolbar: editorToolbarSnapshot(editor),
  };
}
