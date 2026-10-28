import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { importedBlocksToDocument } from "../editor/importedMarkdown";
import { referenceService } from "../application/referenceService";
import { documentService } from "../application/documentService";
import type { Editor } from "@tiptap/core";

export const LAYOUT_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "viewportBlock",
  "rawMarkdown",
  "tableBlock",
  "blockGroup",
] as const;

function dataAttribute(
  attributeName: string,
  dataName: string,
  fallback: number,
) {
  return {
    default: fallback,
    parseHTML: (element: HTMLElement) =>
      Number(element.getAttribute(dataName) ?? fallback) || fallback,
    renderHTML: (attributes: Record<string, unknown>) => ({
      [dataName]: String(attributes[attributeName] ?? fallback),
    }),
  };
}

export const BlockLayout = Extension.create({
  name: "blockLayout",
  addGlobalAttributes() {
    return [
      {
        types: [...LAYOUT_BLOCK_TYPES],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute("data-block-id"),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.blockId
                ? { "data-block-id": String(attributes.blockId) }
                : {},
          },
          span: dataAttribute("span", "data-span", 12),
          zoom: dataAttribute("zoom", "data-zoom", 100),
          heightMode: {
            default: "auto",
            parseHTML: (element: HTMLElement) =>
              element.getAttribute("data-height-mode") === "fixed"
                ? "fixed"
                : "auto",
            renderHTML: (attributes: Record<string, unknown>) => ({
              "data-height-mode":
                attributes.heightMode === "fixed" ? "fixed" : "auto",
            }),
          },
          heightPx: {
            default: 240,
            parseHTML: (element: HTMLElement) =>
              Number(element.getAttribute("data-height") ?? 240) || 240,
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.heightMode === "fixed"
                ? {
                    "data-height": String(attributes.heightPx ?? 240),
                    style: `height:${Number(attributes.heightPx ?? 240)}px`,
                  }
                : { "data-height": String(attributes.heightPx ?? 240) },
          },
        },
      },
    ];
  },
});

export const BlockGroup = Node.create({
  name: "blockGroup",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-block-group]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "block-group",
        "data-block-group": "true",
      }),
      0,
    ];
  },
});

export const ViewportBlock = Node.create({
  name: "viewportBlock",
  group: "block",
  atom: true,
  draggable: true,
  addOptions() {
    return { workspaceRoot: "" };
  },
  addAttributes() {
    return {
      referenceId: { default: "ref_prototype" },
      label: { default: "跨文档视口" },
      targetBlockIds: {
        default: [] as string[],
        parseHTML: (element: HTMLElement) => {
          try {
            const value = JSON.parse(
              element.getAttribute("data-target-block-ids") ?? "[]",
            );
            return Array.isArray(value) ? value : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          Array.isArray(attributes.targetBlockIds) &&
          attributes.targetBlockIds.length > 0
            ? {
                "data-target-block-ids": JSON.stringify(
                  attributes.targetBlockIds,
                ),
              }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-viewport-block]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-viewport-block": "true" }),
      "跨文档视口",
    ];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const workspaceRoot = this.options.workspaceRoot;
      let targetBlockIds: string[] = Array.isArray(node.attrs.targetBlockIds)
        ? node.attrs.targetBlockIds
        : [];
      let previewEditor: Editor | null = null;
      const dom = document.createElement("div");
      dom.className = "proto-viewport";
      let nesting = 0;
      let ancestor: HTMLElement | null = editor.view.dom;
      while (ancestor) {
        if (ancestor.classList.contains("proto-viewport")) {
          nesting += 1;
        }
        ancestor = ancestor.parentElement;
      }
      if (nesting > 3) {
        dom.textContent = "嵌套视口层级过深，已省略";
        return { dom };
      }
      dom.dataset.blockId = String(node.attrs.blockId ?? "");
      dom.dataset.span = String(node.attrs.span ?? 12);
      dom.dataset.heightMode =
        node.attrs.heightMode === "fixed" ? "fixed" : "auto";
      const title = document.createElement("strong");
      title.textContent = "跨文档视口";
      const meta = document.createElement("span");
      meta.textContent = "只读引用";
      const body = document.createElement("div");
      body.className = "proto-viewport-body";
      body.textContent = "加载引用…";
      const applyZoom = (value: unknown) => {
        const zoom = Math.max(50, Math.min(200, Number(value ?? 100)));
        body.style.zoom = `${zoom}%`;
        body.style.width = `${zoom}%`;
      };
      const applyHeight = (current: typeof node) => {
        const fixed = current.attrs.heightMode === "fixed";
        body.style.height = fixed
          ? `${Number(current.attrs.heightPx ?? 240)}px`
          : "";
        body.style.flex = fixed ? "0 0 auto" : "1";
      };
      applyZoom(node.attrs.zoom);
      applyHeight(node);
      const head = document.createElement("div");
      head.className = "proto-viewport-head";
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "proto-viewport-pick";
      pick.textContent = "选择内容";
      pick.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      pick.addEventListener("click", (event) => {
        event.stopPropagation();
        openDocumentBrowser();
      });
      head.append(title, meta, pick);
      dom.append(head, body);

      const openPicker = () => {
        void referenceService
          .listTargets(workspaceRoot)
          .then((targets) => {
            body.replaceChildren();
            if (targets.length === 0) {
              body.textContent = "没有可关联的块";
              return;
            }
            const form = document.createElement("div");
            form.className = "proto-viewport-relink";
            const select = document.createElement("select");
            targets.forEach((target, index) => {
              const option = document.createElement("option");
              option.value = String(index);
              option.textContent = `${target.documentTitle} · ${
                target.preview.trim().slice(0, 32) || target.blockType
              }`;
              select.append(option);
            });
            const confirm = document.createElement("button");
            confirm.type = "button";
            confirm.textContent = "关联";
            confirm.addEventListener("click", () => {
              const target = targets[Number(select.value)];
              if (!target) {
                return;
              }
              void referenceService
                .relink(
                  workspaceRoot,
                  currentReference,
                  target.documentId,
                  target.blockId,
                )
                .then(() => load(currentReference))
                .catch((error) => {
                  body.textContent = String(error);
                });
            });
            form.append(select, confirm);
            body.append(form);
          })
          .catch((error) => {
            body.textContent = String(error);
          });
      };

      const showRelink = (message: string) => {
        body.replaceChildren();
        const error = document.createElement("div");
        error.className = "proto-viewport-error";
        error.textContent = message;
        const relink = document.createElement("button");
        relink.type = "button";
        relink.textContent = "重新关联";
        relink.addEventListener("click", openPicker);
        body.append(error, relink);
      };

      const load = (referenceId: string) => {
        previewEditor?.destroy();
        previewEditor = null;
        if (!workspaceRoot || !referenceId) {
          body.textContent = "未绑定引用";
          return;
        }
        void referenceService
          .preview(workspaceRoot, referenceId)
          .then((preview) => {
            targetBlockId = preview.blockId;
            title.textContent = preview.documentTitle;
            meta.textContent = `引用 ${preview.blockId.slice(0, 18)}…`;
            try {
              const converted = importedBlocksToDocument([
                {
                  id: preview.blockId,
                  documentId: preview.documentId,
                  blockType: preview.blockType,
                  orderKey: "00000000",
                  widthSpan: 12,
                  heightMode: "auto",
                  heightPx: null,
                  contentJson: preview.contentJson,
                  plainText: preview.plainText,
                },
              ]);
              const block = converted.content?.[0];
              if (!block) {
                throw new Error("empty preview");
              }
              const target = editor.schema.nodeFromJSON(block);
              const serializer = DOMSerializer.fromSchema(editor.schema);
              body.replaceChildren(serializer.serializeNode(target));
            } catch {
              body.textContent = preview.plainText.trim() || "（空块）";
            }
          })
          .catch((error) => {
            title.textContent = "引用不可用";
            meta.textContent = "";
            showRelink(String(error));
          });
      };

      const loadMany = (blockIds: string[]) => {
        const ownBlockId = String(node.attrs.blockId ?? "");
        blockIds = blockIds.filter((id) => id !== ownBlockId);
        if (!workspaceRoot || blockIds.length === 0) {
          load(currentReference);
          return;
        }
        void documentService
          .loadBlocksPreview(workspaceRoot, blockIds)
          .then(async (previews) => {
            if (previews.length === 0) {
              body.textContent = "选中的块不存在";
              return;
            }
            title.textContent = previews[0].documentTitle;
            meta.textContent = `${previews.length} 个块`;
            previewEditor?.destroy();
            previewEditor = null;
            body.replaceChildren();
            const { createDocumentPreview } = await import(
              "../editor/previewEditor"
            );
            previewEditor = createDocumentPreview(workspaceRoot, body);
            previewEditor.commands.setContent(
              importedBlocksToDocument(
                previews.map((preview, index) => ({
                  id: preview.blockId,
                  documentId: preview.documentId,
                  blockType: preview.blockType,
                  orderKey: String(index).padStart(8, "0"),
                  widthSpan: 12,
                  heightMode: "auto",
                  heightPx: null,
                  contentJson: preview.contentJson,
                  plainText: preview.plainText,
                })),
              ),
            );
          })
          .catch((error) => {
            title.textContent = "引用不可用";
            meta.textContent = "";
            showRelink(String(error));
          });
      };

      const openDocumentBrowser = () => {
        const overlay = document.createElement("div");
        overlay.className = "proto-viewport-picker";
        const panel = document.createElement("div");
        panel.className = "proto-viewport-picker-panel";
        const heading = document.createElement("strong");
        heading.textContent = "选择引用内容";
        const docSelect = document.createElement("select");
        const list = document.createElement("div");
        list.className = "proto-viewport-picker-list proto-viewport-doc-preview";
        list.contentEditable = "false";
        const hint = document.createElement("div");
        hint.className = "proto-viewport-picker-hint";
        hint.textContent = "在下方文档中拖动选择要引用的内容范围";
        const footer = document.createElement("div");
        footer.className = "proto-viewport-picker-footer";
        const count = document.createElement("span");
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "取消";
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.textContent = "确定";
        footer.append(count, cancel, confirm);
        panel.append(heading, docSelect, hint, list, footer);
        overlay.append(panel);
        document.body.append(overlay);

        let selectedIds: string[] = [];
        let previewEditor: Editor | null = null;
        const updateCount = () => {
          count.textContent = `已选 ${selectedIds.length} 个块`;
          confirm.disabled = selectedIds.length === 0;
        };
        const close = () => {
          overlay.remove();
          document.removeEventListener("selectionchange", onSelectionChange);
          previewEditor?.destroy();
          previewEditor = null;
        };
        cancel.addEventListener("click", close);
        overlay.addEventListener("mousedown", (event) => {
          if (event.target === overlay) close();
        });

        const updateSelection = () => {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            selectedIds = [];
          } else {
            const range = selection.getRangeAt(0);
            selectedIds = [
              ...list.querySelectorAll<HTMLElement>(
                ".ProseMirror > [data-block-id]",
              ),
            ]
              .filter((block) => range.intersectsNode(block))
              .map((block) => block.dataset.blockId ?? "")
              .filter(Boolean);
          }
          list
            .querySelectorAll<HTMLElement>(".ProseMirror > [data-block-id]")
            .forEach((block) => {
              block.classList.toggle(
                "selected",
                selectedIds.includes(block.dataset.blockId ?? ""),
              );
            });
          updateCount();
        };

        const onSelectionChange = () => updateSelection();
        document.addEventListener("selectionchange", onSelectionChange);

        const loadDocument = (documentId: string) => {
          selectedIds = [];
          window.getSelection()?.removeAllRanges();
          updateCount();
          previewEditor?.destroy();
          previewEditor = null;
          list.textContent = "加载文档…";
          void documentService
            .loadBlocks(workspaceRoot, documentId)
            .then(async (blocks) => {
              if (blocks.length === 0) {
                list.textContent = "（空文档）";
                return;
              }
              const { createDocumentPreview } = await import(
                "../editor/previewEditor"
              );
              list.replaceChildren();
              previewEditor = createDocumentPreview(workspaceRoot, list);
              previewEditor.commands.setContent(
                importedBlocksToDocument(
                  blocks.filter(
                    (block) =>
                      block.id !== String(node.attrs.blockId ?? ""),
                  ),
                ),
              );
            })
            .catch((error) => {
              list.textContent = String(error);
            });
        };

        void documentService
          .list(workspaceRoot)
          .then((documents) => {
            docSelect.replaceChildren();
            documents.forEach((documentInfo) => {
              const option = document.createElement("option");
              option.value = documentInfo.id;
              option.textContent = documentInfo.title;
              docSelect.append(option);
            });
            if (documents.length > 0) {
              loadDocument(documents[0].id);
            }
          })
          .catch((error) => {
            list.textContent = String(error);
          });

        docSelect.addEventListener("change", () => {
          loadDocument(docSelect.value);
        });
        confirm.addEventListener("click", () => {
          const ids = selectedIds.filter(
            (id) => id !== String(node.attrs.blockId ?? ""),
          );
          const position = getPos();
          if (typeof position === "number") {
            const currentNode = editor.state.doc.nodeAt(position);
            if (currentNode) {
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(position, undefined, {
                  ...currentNode.attrs,
                  targetBlockIds: ids,
                }),
              );
              loadMany(ids);
            }
          }
          close();
        });
        updateCount();
      };

      const referenceId = String(node.attrs.referenceId ?? "");
      let currentReference = referenceId;
      let targetBlockId = "";
      dom.dataset.referenceId = referenceId;
      if (targetBlockIds.length > 0) {
        loadMany(targetBlockIds);
      } else {
        load(referenceId);
      }
      const onBlocksSaved = (event: Event) => {
        if (targetBlockIds.length > 0) {
          loadMany(targetBlockIds);
          return;
        }
        const detail = (
          event as CustomEvent<{
            blockIds?: string[];
            deletedBlockIds?: string[];
          }>
        ).detail;
        if (
          detail?.blockIds &&
          targetBlockId &&
          !detail.blockIds.includes(targetBlockId) &&
          !detail.deletedBlockIds?.includes(targetBlockId)
        ) {
          return;
        }
        load(currentReference);
      };
      window.addEventListener("tauri-notes:blocks-saved", onBlocksSaved);

      return {
        dom,
        update: (updated) => {
          const nextReference = String(updated.attrs.referenceId ?? "");
          const changed = nextReference !== currentReference;
          const nextIds = Array.isArray(updated.attrs.targetBlockIds)
            ? updated.attrs.targetBlockIds
            : [];
          const idsChanged =
            nextIds.join("|") !== targetBlockIds.join("|");
          currentReference = nextReference;
          targetBlockIds = nextIds;
          dom.dataset.referenceId = nextReference;
          dom.dataset.blockId = String(updated.attrs.blockId ?? "");
          dom.dataset.span = String(updated.attrs.span ?? 12);
          applyZoom(updated.attrs.zoom);
          dom.dataset.heightMode =
            updated.attrs.heightMode === "fixed" ? "fixed" : "auto";
          applyHeight(updated);
          if (idsChanged) {
            if (nextIds.length > 0) {
              loadMany(nextIds);
            } else {
              load(nextReference);
            }
          } else if (changed) {
            load(nextReference);
          }
          return true;
        },
        destroy: () => {
          previewEditor?.destroy();
          previewEditor = null;
          window.removeEventListener("tauri-notes:blocks-saved", onBlocksSaved);
        },
      };
    };
  },
});

function tableRows(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"))
    .map((line) => {
      let text = line;
      if (text.startsWith("|")) text = text.slice(1);
      if (text.endsWith("|")) text = text.slice(0, -1);
      return text.split("|").map((cell) => cell.trim());
    });
}

function isDivider(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

type TableAlignment = "left" | "center" | "right" | null;

function serializeTable(
  header: string[],
  rows: string[][],
  alignments: TableAlignment[],
): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const divider = header.map((_, index) => {
    const alignment = alignments[index] ?? null;
    if (alignment === "center") return ":---:";
    if (alignment === "right") return "---:";
    if (alignment === "left") return ":---";
    return "---";
  });
  return [line(header), line(divider), ...rows.map(line)].join("\n");
}

function alignmentFrom(cell: string): TableAlignment {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (left) return "left";
  if (right) return "right";
  return null;
}

function fitTableInput(input: HTMLInputElement) {
  const width = Array.from(input.value).reduce(
    (total, character) =>
      total + (/[\u3000-\u9fff\uff00-\uffef]/.test(character) ? 2 : 1),
    2,
  );
  input.style.minWidth = `${Math.max(6, width)}ch`;
}

function buildTable(
  markdown: string,
  canEdit: () => boolean = () => false,
  onChange?: (markdown: string) => void,
): HTMLElement {
  const rows = tableRows(markdown);
  const table = document.createElement("table");
  table.className = "proto-table";
  const dividerIndex = rows.findIndex(isDivider);
  const rawHeader = dividerIndex > 0 ? rows[dividerIndex - 1] : [];
  const bodyRows =
    dividerIndex >= 0 ? rows.slice(dividerIndex + 1) : rows.slice(1);
  const allRows = [rawHeader, ...bodyRows];
  const maxColumns = Math.max(...allRows.map((row) => row.length), 1);
  const blankColumn = (column: number) =>
    allRows.every((row) => !row[column]?.trim());
  let first = 0;
  let last = maxColumns - 1;
  while (first < last && blankColumn(first)) first += 1;
  while (last > first && blankColumn(last)) last -= 1;
  const header = rawHeader.slice(first, last + 1);
  const normalizedRows = bodyRows.map((row) => row.slice(first, last + 1));
  const divider = dividerIndex >= 0 ? rows[dividerIndex] : [];
  const alignments: TableAlignment[] = Array.from(
    { length: Math.max(header.length, 1) },
    (_, index) => alignmentFrom(divider[index] ?? ""),
  );
  let columnCount = Math.max(header.length, 1);

  const emit = () => {
    if (onChange) {
      onChange(
        serializeTable(
          Array.from({ length: columnCount }, (_, index) => header[index] ?? ""),
          normalizedRows,
          alignments,
        ),
      );
    }
  };

  if (header.length > 0) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (let column = 0; column < columnCount; column += 1) {
      const th = document.createElement("th");
      const input = document.createElement("input");
      input.className = "proto-table-input";
      input.value = header[column] ?? "";
      input.disabled = !canEdit();
      fitTableInput(input);
      input.style.textAlign = alignments[column] ?? "";
      input.addEventListener("input", () => fitTableInput(input));
      input.addEventListener("change", () => {
        header[column] = input.value;
        fitTableInput(input);
        emit();
      });
      th.append(input);
      tr.append(th);
    }
    thead.append(tr);
    table.append(thead);
  }

  const tbody = document.createElement("tbody");
  for (const [rowIndex, row] of normalizedRows.entries()) {
    const tr = document.createElement("tr");
    for (let column = 0; column < columnCount; column += 1) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.className = "proto-table-input";
      input.value = row[column] ?? "";
      input.disabled = !canEdit();
      fitTableInput(input);
      input.style.textAlign = alignments[column] ?? "";
      input.addEventListener("input", () => fitTableInput(input));
      input.addEventListener("change", () => {
        normalizedRows[rowIndex][column] = input.value;
        fitTableInput(input);
        emit();
      });
      td.append(input);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  const container = document.createElement("div");
  container.className = "proto-table-container";
  const scroll = document.createElement("div");
  scroll.className = "proto-table-scroll";
  scroll.append(table);
  container.append(scroll);

  const tools = document.createElement("div");
  tools.className = "proto-table-tools";
  const addButton = (label: string, action: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!canEdit()) {
        return;
      }
      action();
    });
    tools.append(button);
  };
  addButton("+ 行", () => {
    normalizedRows.push(new Array(columnCount).fill(""));
    emit();
  });
  addButton("− 行", () => {
    if (normalizedRows.length > 0) {
      normalizedRows.pop();
      emit();
    }
  });
  addButton("+ 列", () => {
    header.push("新列");
    normalizedRows.forEach((row) => row.push(""));
    alignments.push(null);
    columnCount += 1;
    emit();
  });
  addButton("− 列", () => {
    if (columnCount > 1) {
      header.pop();
      normalizedRows.forEach((row) => row.pop());
      alignments.pop();
      columnCount -= 1;
      emit();
    }
  });
  container.append(tools);
  return container;
}

export const TableBlock = Node.create({
  name: "tableBlock",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      markdown: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-table-block]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-table-block": "true" }),
      String(HTMLAttributes.markdown ?? ""),
    ];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement("div");
      wrapper.className = "proto-table-wrap";
      const stopEditorEvents = (event: Event) => {
        if ((event.target as HTMLElement).closest("input")) {
          event.stopPropagation();
        }
      };
      [
        "keydown",
        "keypress",
        "beforeinput",
        "input",
        "paste",
        "cut",
        "copy",
        "compositionstart",
        "compositionupdate",
        "compositionend",
      ].forEach((type) =>
        wrapper.addEventListener(type, stopEditorEvents),
      );
      const applyLayout = (current: typeof node) => {
        wrapper.dataset.blockId = String(current.attrs.blockId ?? "");
        wrapper.dataset.span = String(current.attrs.span ?? 12);
        wrapper.style.setProperty(
          "--block-zoom",
          `${Math.max(50, Math.min(200, Number(current.attrs.zoom ?? 100)))}%`,
        );
        wrapper.style.setProperty(
          "--block-zoom-width",
          `${Math.max(50, Math.min(200, Number(current.attrs.zoom ?? 100)))}%`,
        );
        wrapper.dataset.heightMode =
          current.attrs.heightMode === "fixed" ? "fixed" : "auto";
        wrapper.style.height =
          current.attrs.heightMode === "fixed"
            ? `${Number(current.attrs.heightPx ?? 240)}px`
            : "";
      };
      applyLayout(node);
      const render = (markdown: string) => {
        wrapper.replaceChildren(
          buildTable(markdown, () => editor.isEditable, (next) => {
            const position = getPos();
            if (typeof position === "number") {
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(position, undefined, {
                  ...node.attrs,
                  markdown: next,
                }),
              );
            }
          }),
        );
      };
      render(String(node.attrs.markdown ?? ""));
      wrapper.addEventListener("mousedown", (event) => {
        if (!editor.isEditable) {
          return;
        }
        wrapper
          .querySelectorAll<HTMLInputElement>(".proto-table-input")
          .forEach((input) => {
            input.disabled = false;
          });
        const input = (event.target as HTMLElement).closest("input");
        if (input) {
          event.stopPropagation();
          input.focus();
        }
      });
      return {
        dom: wrapper,
        update: (updated) => {
          applyLayout(updated);
          render(String(updated.attrs.markdown ?? ""));
          return true;
        },
      };
    };
  },
});

export const TaskList = Node.create({
  name: "taskList",
  group: "block",
  content: "taskItem+",
  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "ul",
      mergeAttributes(HTMLAttributes, { "data-type": "taskList" }),
      0,
    ];
  },
});

export const TaskItem = Node.create({
  name: "taskItem",
  content: "paragraph block*",
  defining: true,
  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-checked") === "true",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-type": "taskItem",
          "data-checked": attributes.checked ? "true" : "false",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'li[data-type="taskItem"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["li", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const li = document.createElement("li");
      li.dataset.type = "taskItem";
      li.dataset.checked = node.attrs.checked ? "true" : "false";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(node.attrs.checked);
      input.addEventListener("mousedown", (event) => event.stopPropagation());
      input.addEventListener("input", () => fitTableInput(input));
      input.addEventListener("change", () => {
        if (!editor.isEditable) {
          input.checked = Boolean(node.attrs.checked);
          return;
        }
        const position = getPos();
        if (typeof position === "number") {
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(position, undefined, {
              ...node.attrs,
              checked: input.checked,
            }),
          );
        }
      });
      const content = document.createElement("div");
      content.className = "task-content";
      li.append(input, content);
      return {
        dom: li,
        contentDOM: content,
        update: (updated) => {
          input.checked = Boolean(updated.attrs.checked);
          li.dataset.checked = updated.attrs.checked ? "true" : "false";
          return true;
        },
      };
    };
  },
});

export const ImageInline = Node.create({
  name: "image",
  inline: true,
  group: "inline",
  atom: true,
  addAttributes() {
    return {
      src: { default: "" },
      originalSrc: { default: "" },
      alt: { default: "" },
      title: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement("img");
      img.className = "proto-inline-image";
      img.src = String(node.attrs.src ?? "");
      img.alt = String(node.attrs.alt ?? "");
      img.title = String(node.attrs.title ?? "");
      img.loading = "lazy";
      return { dom: img };
    };
  },
});

export const RawMarkdownBlock = Node.create({  name: "rawMarkdown",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      markdown: { default: "" },
      kind: { default: "unknown" },
    };
  },
  parseHTML() {
    return [{ tag: "pre[data-raw-markdown]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, { "data-raw-markdown": "true" }),
      String(HTMLAttributes.markdown ?? ""),
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const pre = document.createElement("pre");
      pre.className = "proto-raw-markdown";
      pre.dataset.rawMarkdown = "true";
      pre.textContent = String(node.attrs.markdown ?? "");
      return { dom: pre };
    };
  },
});

export function seedDocument(): JSONContent {
  const paragraph = (text: string, span = 12): JSONContent => ({
    type: "paragraph",
    attrs: { span, heightMode: "auto", heightPx: 240 },
    content: [{ type: "text", text }],
  });
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, span: 12, heightMode: "auto", heightPx: 240 },
        content: [{ type: "text", text: "块编辑器原型" }],
      },
      paragraph(
        "这是一个单编辑器 + 多列布局原型。默认排版应该像 Typora：连续文档流，块边界不可见。",
        12,
      ),
      paragraph(
        "只有当你改变块宽或高度时，块才进入布局模式；没有调整的块保持普通文档流。",
        12,
      ),
      paragraph(
        "跨块选择：从这段文字拖到下一段文字，选择应该连续；撤销应该跨块生效。",
        12,
      ),
      {
        type: "bulletList",
        attrs: { span: 12, heightMode: "auto", heightPx: 240 },
        content: [
          {
            type: "listItem",
            content: [paragraph("块宽用 12 列跨度表达。", 12)],
          },
          {
            type: "listItem",
            content: [paragraph("高度支持 auto 和 fixed。", 12)],
          },
          {
            type: "listItem",
            content: [paragraph("固定高度时块内滚动。", 12)],
          },
        ],
      },
      {
        type: "codeBlock",
        attrs: {
          language: "rust",
          span: 12,
          heightMode: "fixed",
          heightPx: 220,
        },
        content: [
          {
            type: "text",
            text: 'fn main() {\n    println!("hello, block editor");\n}',
          },
        ],
      },
      paragraph(
        "下面是普通段落，用来验证网格换行和固定高度的行高计算。",
        12,
      ),
    ],
  };
}
