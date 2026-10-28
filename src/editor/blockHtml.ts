import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { DOMSerializer } from "@tiptap/pm/model";
import {
  BlockLayout,
  ImageInline,
  RawMarkdownBlock,
  TableBlock,
  TaskItem,
  TaskList,
  ViewportBlock,
} from "../prototype/blockExtensions";
import { CodeBlockView } from "../prototype/codeBlockView";
import { importedBlocksToDocument } from "./importedMarkdown";

let schema: ReturnType<typeof getSchema> | null = null;

function getPreviewSchema() {
  schema ??= getSchema([
    StarterKit.configure({ codeBlock: false }),
    CodeBlockView,
    BlockLayout,
    ViewportBlock.configure({ workspaceRoot: "" }),
    RawMarkdownBlock,
    TableBlock,
    ImageInline,
    TaskList,
    TaskItem,
  ]);
  return schema;
}

export function renderBlockHtml(
  contentJson: string,
  blockType: string,
): string {
  try {
    const converted = importedBlocksToDocument([
      {
        id: "board_preview",
        documentId: "board/preview",
        blockType,
        orderKey: "00000000",
        widthSpan: 12,
        heightMode: "auto",
        heightPx: null,
        contentJson,
        plainText: "",
      },
    ]);
    const block = converted.content?.[0];
    if (!block) {
      return "";
    }
    const previewSchema = getPreviewSchema();
    const node = previewSchema.nodeFromJSON(block);
    const serializer = DOMSerializer.fromSchema(previewSchema);
    const wrapper = document.createElement("div");
    wrapper.append(serializer.serializeNode(node));
    return wrapper.innerHTML;
  } catch {
    return "";
  }
}
