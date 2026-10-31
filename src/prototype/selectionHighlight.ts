import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type SelectableBlock = {
  isAtom: boolean;
  type: { name: string };
};

/**
 * Text blocks are already covered by the native text selection. Only
 * atom-like cards need a block-level tint, otherwise Ctrl+A paints every
 * paragraph as a separate card and the selection looks fragmented.
 */
export function shouldHighlightBlock(node: SelectableBlock): boolean {
  return (
    node.isAtom ||
    node.type.name === "codeBlock" ||
    node.type.name === "tableBlock"
  );
}

/**
 * 顶层块与当前选区相交时，给需要块级提示的节点加 block-selected。
 * 普通段落/标题/列表只显示原生文本选区。
 */
export const BlockSelectionHighlight = Extension.create({
  name: "blockSelectionHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockSelectionHighlight"),
        props: {
          decorations(state) {
            const { from, to } = state.selection;
            if (from === to) {
              return null;
            }
            const decorations: Decoration[] = [];
            state.doc.forEach((node, offset) => {
              if (
                shouldHighlightBlock(node) &&
                offset + node.nodeSize > from &&
                offset < to
              ) {
                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: "block-selected",
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
