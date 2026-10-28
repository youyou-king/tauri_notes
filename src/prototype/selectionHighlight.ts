import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * 顶层块与当前选区相交时，给块节点加 block-selected。
 * 全选/跨块文本选区也能在卡片、viewport 上看到选中态。
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
              if (offset + node.nodeSize > from && offset < to) {
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
