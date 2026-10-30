import type { JSONContent } from "@tiptap/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SaveBlock, StoredBlock } from "../domain/importedDocument";
import { isMarkdownTable } from "./markdownTable";

type RawMarkdownAttrs = {
  markdown?: string;
  kind?: string;
};

function parseInline(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const pattern =
    /(!\[[^\]]*\]\([^)]+\)|<https?:\/\/[^>\s]+>|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push({ type: "text", text: text.slice(cursor, index) });
    }
    const token = match[0];
    if (token.startsWith("<http")) {
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        marks: [{ type: "link", attrs: { href: token.slice(1, -1) } }],
      });
    } else if (token.startsWith("![")) {
      const image = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (image) {
        nodes.push({
          type: "image",
          attrs: { src: image[2], alt: image[1], title: "" },
        });
      } else {
        nodes.push({ type: "text", text: token });
      }
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push({
        type: "text",
        text: token.slice(2, -2),
        marks: [{ type: "bold" }],
      });
    } else if (token.startsWith("~~")) {
      nodes.push({
        type: "text",
        text: token.slice(2, -2),
        marks: [{ type: "strike" }],
      });
    } else if (token.startsWith("`")) {
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        marks: [{ type: "code" }],
      });
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push({
          type: "text",
          text: link[1],
          marks: [{ type: "link", attrs: { href: link[2] } }],
        });
      } else {
        nodes.push({ type: "text", text: token });
      }
    } else {
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        marks: [{ type: "italic" }],
      });
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) {
    nodes.push({ type: "text", text: text.slice(cursor) });
  }
  return nodes.length > 0 ? nodes : [{ type: "text", text: "" }];
}

function parseParagraph(text: string): JSONContent[] {
  const lines = text.split(/\r?\n/);
  const nodes: JSONContent[] = [];
  lines.forEach((rawLine, index) => {
    const hardBreak = / {2,}$/.test(rawLine) || /\\$/.test(rawLine);
    const line = rawLine.replace(/ {2,}$/, "").replace(/\\$/, "");
    if (line.length > 0) {
      nodes.push(...parseInline(line));
    }
    if (index < lines.length - 1) {
      nodes.push(
        hardBreak
          ? { type: "hardBreak" }
          : { type: "text", text: " " },
      );
    }
  });
  return nodes;
}

function layoutAttrs(block: StoredBlock) {
  return {
    blockId: block.id,
    span: block.widthSpan,
    heightMode: block.heightMode,
    heightPx: block.heightPx ?? 240,
  };
}

function codeLanguage(markdown: string): string {
  const first = markdown.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const match = first.match(/^(?:```|~~~)\s*([\w-]*)/);
  return match?.[1] ?? "";
}

function codeBody(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines.length >= 2) {
    return lines.slice(1, -1).join("\n");
  }
  return markdown;
}

function listNode(markdown: string, block: StoredBlock): JSONContent {
  const items = markdown
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
      if (!match) {
        return null;
      }
      const task = match[3].match(/^\[( |x|X)\]\s+(.*)$/);
      return {
        indent: match[1].replace(/\t/g, "  ").length,
        ordered: /^\d/.test(match[2]),
        start: /^\d/.test(match[2]) ? Number(match[2]) : 1,
        text: task ? task[2] : match[3],
        task: task ? task[1].toLowerCase() === "x" : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) {
    return {
      type: "bulletList",
      attrs: layoutAttrs(block),
      content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
    };
  }

  let cursor = 0;
  const parseLevel = (
    indent: number,
    ordered: boolean,
    taskMode: boolean,
  ): JSONContent => {
    const content: JSONContent[] = [];
    while (cursor < items.length) {
      const item = items[cursor];
      if (item.indent < indent || item.indent > indent) {
        break;
      }
      cursor += 1;
      const children: JSONContent[] = [];
      if (cursor < items.length && items[cursor].indent > indent) {
        const child = items[cursor];
        children.push(parseLevel(child.indent, child.ordered, child.task !== null));
      }
      content.push(
        taskMode
          ? {
              type: "taskItem",
              attrs: { checked: Boolean(item.task) },
              content: [
                { type: "paragraph", content: parseInline(item.text) },
                ...children,
              ],
            }
          : {
              type: "listItem",
              content: [
                { type: "paragraph", content: parseInline(item.text) },
                ...children,
              ],
            },
      );
    }
    return {
      type: taskMode ? "taskList" : ordered ? "orderedList" : "bulletList",
      content,
    };
  };

  const taskMode = items[0].task !== null;
  const root = parseLevel(items[0].indent, items[0].ordered, taskMode);
  root.attrs = {
    ...layoutAttrs(block),
    ...(!taskMode && items[0].ordered ? { start: items[0].start } : {}),
  };
  return root;
}

function quoteNode(markdown: string, block: StoredBlock): JSONContent {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*>\s?/, ""));
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim()) {
      current.push(line.trim());
    } else if (current.length > 0) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join(" "));
  }
  return {
    type: "blockquote",
    attrs: layoutAttrs(block),
    content:
      paragraphs.length > 0
        ? paragraphs.map((text) => ({
            type: "paragraph",
            content: parseInline(text),
          }))
        : [{ type: "paragraph" }],
  };
}

const CONVERTED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "tableBlock",
  "horizontalRule",
  "viewportBlock",
  "blockGroup",
]);

function convertRawBlock(block: StoredBlock): JSONContent {
  const content = JSON.parse(block.contentJson || "{}") as {
    type?: string;
    attrs?: RawMarkdownAttrs & Record<string, unknown>;
  };
  const attrs = content.attrs ?? {};
  const markdown = attrs.markdown ?? block.plainText;
  const kind = attrs.kind ?? block.blockType;

  if (
    isMarkdownTable(markdown) &&
    (content.type === "paragraph" ||
      content.type === "rawMarkdown" ||
      !content.type) &&
    kind !== "code"
  ) {
    return {
      type: "tableBlock",
      attrs: { ...layoutAttrs(block), markdown: markdown.trim() },
    };
  }

  if (content.type && CONVERTED_BLOCK_TYPES.has(content.type)) {
    return {
      ...(content as JSONContent),
      attrs: { ...(content.attrs ?? {}), ...layoutAttrs(block) },
    };
  }

  if (content.type === "viewport" || block.blockType === "viewport") {
    return {
      type: "viewportBlock",
      attrs: {
        ...layoutAttrs(block),
        referenceId: String(attrs.referenceId ?? ""),
        targetBlockId: String(attrs.targetBlockId ?? ""),
      },
    };
  }

  if (kind.startsWith("heading:")) {
    const level = Math.max(1, Math.min(6, Number(kind.split(":")[1] ?? 1)));
    return {
      type: "heading",
      attrs: { ...layoutAttrs(block), level },
      content: parseInline(markdown.replace(/^#{1,6}\s+/, "")),
    };
  }
  if (kind === "paragraph") {
    return {
      type: "paragraph",
      attrs: layoutAttrs(block),
      content: parseParagraph(markdown.trim()),
    };
  }
  if (kind.startsWith("list:")) {
    return listNode(markdown, block);
  }
  if (kind === "quote") {
    return quoteNode(markdown, block);
  }
  if (kind === "code") {
    return {
      type: "codeBlock",
      attrs: {
        ...layoutAttrs(block),
        language: codeLanguage(markdown),
      },
      content: [{ type: "text", text: codeBody(markdown) }],
    };
  }
  if (kind === "rule") {
    return { type: "horizontalRule", attrs: layoutAttrs(block) };
  }
  if (kind === "table") {
    return {
      type: "tableBlock",
      attrs: { ...layoutAttrs(block), markdown },
    };
  }
  return {
    type: "rawMarkdown",
    attrs: { ...layoutAttrs(block), markdown, kind },
  };
}

export function importedBlocksToDocument(
  blocks: StoredBlock[],
): JSONContent {  return {
    type: "doc",
    content: blocks.map((block) => {
      try {
        return convertRawBlock(block);
      } catch {
        return {
          type: "rawMarkdown",
          attrs: {
            ...layoutAttrs(block),
            markdown: block.plainText,
            kind: block.blockType,
          },
        };
      }
    }),
  };
}

export function resolveImageSource(
  src: string,
  workspace: string,
  documentId: string,
): string {
  if (!src || /^(https?:|data:|blob:|asset:)/i.test(src)) {
    return src;
  }
  const normalizedWorkspace = workspace.replace(/\\/g, "/").replace(/\/+$/, "");
  const mapId = documentId.split("/")[0] ?? "";
  const relative = src.replace(/^\.\//, "").replace(/^\/+/, "");
  const base = src.startsWith("/")
    ? normalizedWorkspace
    : `${normalizedWorkspace}/${mapId}/docs`;
  return convertFileSrc(`${base}/${relative}`);
}

export function resolveImageSources(
  document: JSONContent,
  workspace: string,
  documentId: string,
): JSONContent {
  const visit = (node: JSONContent): JSONContent => {
    if (node.type === "image") {
      return {
        ...node,
        attrs: {
          ...node.attrs,
          originalSrc: String(node.attrs?.src ?? ""),
          src: resolveImageSource(
            String(node.attrs?.src ?? ""),
            workspace,
            documentId,
          ),
        },
      };
    }
    return {
      ...node,
      content: node.content?.map(visit),
    };
  };
  return visit(document);
}

function storageContent(node: JSONContent): JSONContent {
  if (node.type === "image" && node.attrs?.originalSrc) {
    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: String(node.attrs.originalSrc),
        originalSrc: "",
      },
    };
  }
  return {
    ...node,
    content: node.content?.map(storageContent),
  };
}

function textContentOf(node: JSONContent): string {  if (node.type === "tableBlock" || node.type === "rawMarkdown") {
    return String(node.attrs?.markdown ?? "");
  }
  if (typeof node.text === "string") {
    return node.text;
  }
  return (node.content ?? []).map(textContentOf).join("");
}

function blockTypeOf(node: JSONContent): string {
  switch (node.type) {
    case "heading":
      return "heading";
    case "paragraph":
      return "paragraph";
    case "bulletList":
    case "orderedList":
    case "taskList":
      return "list";
    case "blockquote":
      return "quote";
    case "codeBlock":
      return "code";
    case "tableBlock":
      return "table";
    case "horizontalRule":
      return "rule";
    case "viewportBlock":
      return "viewport";
    case "blockGroup":
      return "group";
    default:
      return "raw";
  }
}

export function documentToSaveBlocks(document: JSONContent): SaveBlock[] {
  return (document.content ?? []).map((node, index) => {
    const attrs = node.attrs ?? {};
    const id =
      typeof attrs.blockId === "string" && attrs.blockId
        ? attrs.blockId
        : `block_${crypto.randomUUID().replace(/-/g, "")}`;
    const widthSpan = Math.max(1, Math.min(12, Number(attrs.span ?? 12)));
    const heightMode = attrs.heightMode === "fixed" ? "fixed" : "auto";
    const heightPx =
      heightMode === "fixed" ? Number(attrs.heightPx ?? 240) : null;
    node.attrs = {
      ...attrs,
      blockId: id,
      span: widthSpan,
      heightMode,
      heightPx: heightPx ?? 240,
    };
    return {
      id,
      blockType: blockTypeOf(node),
      orderKey: index.toString().padStart(8, "0"),
      widthSpan,
      heightMode,
      heightPx,
      contentJson: JSON.stringify(storageContent(node)),
      plainText: textContentOf(node),
    };
  });
}
