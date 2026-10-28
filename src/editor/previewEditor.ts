import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  BlockGroup,
  BlockLayout,
  ImageInline,
  RawMarkdownBlock,
  TableBlock,
  TaskItem,
  TaskList,
  ViewportBlock,
} from "../prototype/blockExtensions";
import { CodeBlockView } from "../prototype/codeBlockView";
import { CodeHighlight } from "../prototype/codeHighlight";

export function createDocumentPreview(
  workspaceRoot: string,
  element: HTMLElement,
) {
  return new Editor({
    element,
    editable: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockView,
      CodeHighlight,
      BlockLayout,
      BlockGroup,
      ViewportBlock.configure({ workspaceRoot }),
      RawMarkdownBlock,
      TableBlock,
      ImageInline,
      TaskList,
      TaskItem,
    ],
    content: { type: "doc", content: [] },
  });
}
