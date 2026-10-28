import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { documentService } from "../../application/documentService";
import { assetService } from "../../application/assetService";
import StarterKit from "@tiptap/starter-kit";
import {
  BlockLayout,
  BlockGroup,
  ImageInline,
  RawMarkdownBlock,
  TableBlock,
  TaskItem,
  TaskList,
  ViewportBlock,
} from "../../prototype/blockExtensions";
import { TauriImportedDocumentRepository } from "../../infrastructure/tauriImportedDocumentRepository";
import { CodeBlockView } from "../../prototype/codeBlockView";
import { CodeHighlight } from "../../prototype/codeHighlight";
import { MarkdownInlineRules } from "../../prototype/markdownInlineRules";
import { BlockSelectionHighlight } from "../../prototype/selectionHighlight";
import {
  documentToSaveBlocks,
  importedBlocksToDocument,
  resolveImageSource,
  resolveImageSources,
} from "../../editor/importedMarkdown";
import type { Editor } from "@tiptap/react";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";

type SelectedBlock = {
  pos: number;
  type: string;
  span: number;
  heightMode: "auto" | "fixed";
  heightPx: number;
  zoom: number;
};

function blockSignature(block: {
  orderKey: string;
  contentJson: string;
}): string {
  return `${block.orderKey}|${block.contentJson}`;
}

function findSelectedBlock(editor: Editor): SelectedBlock | null {
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

function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

export default function ImportedPreviewPane({
  workspaceRoot,
  documentId,
}: {
  workspaceRoot: string;
  documentId?: string;
}) {
  const repository = useMemo(
    () => new TauriImportedDocumentRepository(workspaceRoot),
    [workspaceRoot],
  );
  const [status, setStatus] = useState("加载文档…");
  const [documentTitle, setDocumentTitle] = useState("");
  const editing = true;
  const [saving, setSaving] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [stats, setStats] = useState({ blocks: 0, characters: 0 });
  const selectedRef = useRef("");
  const editingRef = useRef(true);
  const loadingRef = useRef(true);
  const savedRef = useRef(new Map<string, string>());
  const saveTimer = useRef<number | null>(null);
  const flushSave = useRef<(() => void) | null>(null);
  const insertImageFileRef = useRef<(file: File) => void>(() => {});
  const previewAtomRef = useRef<HTMLElement | null>(null);
  const activeDocumentId = documentId ?? "";

  useEffect(() => {
    if (!activeDocumentId) {
      setDocumentTitle("");
      return;
    }
    let cancelled = false;
    void documentService
      .getTitle(workspaceRoot, activeDocumentId)
      .then((title) => {
        if (!cancelled) {
          setDocumentTitle(title);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentTitle("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeDocumentId, workspaceRoot]);

  useEffect(() => {
    if (!activeDocumentId) {
      return;
    }
    const refresh = () => {
      if (
        document.activeElement?.classList.contains("block-document-title")
      ) {
        return;
      }
      void documentService
        .getTitle(workspaceRoot, activeDocumentId)
        .then((title) => {
          setDocumentTitle(title);
        })
        .catch(() => {});
    };
    window.addEventListener("tauri-notes:blocks-saved", refresh);
    window.addEventListener("tauri-notes:document-changed", refresh);
    window.addEventListener("tauri-notes:document-renamed", refresh);
    window.addEventListener("tauri-notes:maps-changed", refresh);
    return () => {
      window.removeEventListener("tauri-notes:blocks-saved", refresh);
      window.removeEventListener("tauri-notes:document-changed", refresh);
      window.removeEventListener("tauri-notes:document-renamed", refresh);
      window.removeEventListener("tauri-notes:maps-changed", refresh);
    };
  }, [activeDocumentId, workspaceRoot]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: { markdownLinks: true },
      }),
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
      MarkdownInlineRules,
      BlockSelectionHighlight,
    ],
    editable: false,
    content: { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class: "block-prototype-prosemirror imported-preview",
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        files.forEach((file) => insertImageFileRef.current(file));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        files.forEach((file) => insertImageFileRef.current(file));
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      if (!editingRef.current || loadingRef.current) {
        return;
      }
      setSelectedBlock(findSelectedBlock(current));
      setStats({
        blocks: current.state.doc.childCount,
        characters: current.state.doc.textContent.length,
      });
      setStatus("未保存");
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(() => {
        flushSave.current?.();
      }, 600);
      flushSave.current = () => {
        const blocks = documentToSaveBlocks(current.getJSON());
        const activeIds = new Set(blocks.map((block) => block.id));
        const changed = blocks.filter(
          (block) =>
            savedRef.current.get(block.id) !== blockSignature(block),
        );
        const deleted = [...savedRef.current.keys()].filter(
          (id) => !activeIds.has(id),
        );
        if (changed.length === 0 && deleted.length === 0) {
          setStatus("已保存");
          return;
        }
        setSaving(true);
        void repository
          .saveBlocks(selectedRef.current, changed, deleted)
          .then(() => {
            blocks.forEach((block) =>
              savedRef.current.set(block.id, blockSignature(block)),
            );
            deleted.forEach((id) => savedRef.current.delete(id));
            setStatus("已保存");
            window.dispatchEvent(
              new CustomEvent("tauri-notes:blocks-saved", {
                detail: {
                  documentId: selectedRef.current,
                  blockIds: changed.map((block) => block.id),
                  deletedBlockIds: deleted,
                },
              }),
            );
          })
          .catch((error) => setStatus(`保存失败：${String(error)}`))
          .finally(() => setSaving(false));
      };
    },
    onSelectionUpdate: ({ editor: current }) => {
      setSelectedBlock(findSelectedBlock(current));
    },
  });

  useEffect(() => {
    editingRef.current = editing;
    if (!editor) {
      return;
    }
    editor.setEditable(editing);
    // 重建 NodeView，让表格在只读文本和可编辑输入格之间切换。
    editor.commands.setContent(editor.getJSON(), { emitUpdate: false });
  }, [editing, editor]);

  useEffect(() => {
    selectedRef.current = activeDocumentId;
  }, [activeDocumentId]);

  useEffect(() => {
    if (!editor || !activeDocumentId) {
      return;
    }
    let cancelled = false;
    loadingRef.current = true;
    setStatus("加载块…");
    void repository
      .loadBlocks(activeDocumentId)
      .then((blocks) => {
        if (cancelled) {
          return;
        }
        editor.commands.setContent(
          resolveImageSources(
            importedBlocksToDocument(blocks),
            workspaceRoot,
            activeDocumentId,
          ),
        );
        if (editor.state.doc.content.size > 0) {
          editor.commands.setTextSelection(1);
        }
        const serialized = documentToSaveBlocks(editor.getJSON());
        savedRef.current = new Map(
          serialized.map(
            (block) => [block.id, blockSignature(block)] as const,
          ),
        );
        loadingRef.current = false;
        setSelectedBlock(null);
        editor.view.dom.classList.toggle("large-document", blocks.length > 300);
        setStats({
          blocks: editor.state.doc.childCount,
          characters: editor.state.doc.textContent.length,
        });
        setStatus("已加载");
      })
      .catch((error) => {
        loadingRef.current = false;
        setStatus(`读取块失败：${String(error)}`);
      });
    return () => {
      cancelled = true;
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [activeDocumentId, editor, repository]);

  const insertImageFile = (file: File) => {
    if (!editor || !editing || !activeDocumentId) {
      return;
    }
    void file
      .arrayBuffer()
      .then(async (buffer) => {
        const note = workspaceRoot.toLowerCase().endsWith(".note");
        const dataUrl = note ? await fileDataUrl(file) : "";
        const relative = await assetService.saveImage({
          workspace: workspaceRoot,
          documentId: activeDocumentId,
          fileName: file.name,
          bytes: Array.from(new Uint8Array(buffer)),
          noteFile: note,
        });
        const src = dataUrl || resolveImageSource(
          relative,
          workspaceRoot,
          activeDocumentId,
        );
        editor
          .chain()
          .focus()
          .insertContent({
            type: "image",
            attrs: {
              src,
              originalSrc: dataUrl || relative,
              alt: file.name,
              title: "",
            },
          })
          .run();
        setStatus("图片已插入");
      })
      .catch((error) => setStatus(`插入图片失败：${String(error)}`));
  };
  insertImageFileRef.current = insertImageFile;

  const moveBlock = (direction: -1 | 1) => {
    if (!editor || !selectedBlock) {
      return;
    }
    const blocks = [...editor.state.doc.content.content];
    let index = -1;
    let offset = 0;
    for (let position = 0; position < blocks.length; position += 1) {
      if (offset === selectedBlock.pos) {
        index = position;
        break;
      }
      offset += blocks[position].nodeSize;
    }
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) {
      return;
    }
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    editor.view.dispatch(
      editor.state.tr.replaceWith(
        0,
        editor.state.doc.content.size,
        Fragment.fromArray(blocks),
      ),
    );
    setSelectedBlock(null);
  };

  const duplicateBlock = () => {
    if (!editor || !selectedBlock) {
      return;
    }
    const node = editor.state.doc.nodeAt(selectedBlock.pos);
    if (!node) {
      return;
    }
    const clone = node.toJSON();
    clone.attrs = {
      ...clone.attrs,
      blockId: `block_${crypto.randomUUID().replace(/-/g, "")}`,
    };
    const inserted = editor.schema.nodeFromJSON(clone);
    editor.view.dispatch(
      editor.state.tr.insert(
        selectedBlock.pos + node.nodeSize,
        inserted,
      ),
    );
    setSelectedBlock(null);
  };

  const deleteBlock = () => {
    if (!editor || !selectedBlock) {
      return;
    }
    if (editor.state.doc.childCount <= 1) {
      return;
    }
    const node = editor.state.doc.nodeAt(selectedBlock.pos);
    if (!node) {
      return;
    }
    editor.view.dispatch(
      editor.state.tr.delete(
        selectedBlock.pos,
        selectedBlock.pos + node.nodeSize,
      ),
    );
    setSelectedBlock(null);
  };

  const ungroupBlock = () => {
    if (!editor || !selectedBlock || selectedBlock.type !== "blockGroup") {
      return;
    }
    const node = editor.state.doc.nodeAt(selectedBlock.pos);
    if (!node || node.type.name !== "blockGroup") {
      return;
    }
    const children: PMNode[] = [];
    node.forEach((child) => children.push(child));
    if (children.length === 0) {
      return;
    }
    editor.view.dispatch(
      editor.state.tr.replaceWith(
        selectedBlock.pos,
        selectedBlock.pos + node.nodeSize,
        Fragment.fromArray(children),
      ),
    );
    setSelectedBlock(null);
  };

  const updateLayout = (patch: Partial<SelectedBlock>) => {    if (!editor || !editing || !selectedBlock) {
      return;
    }
    if (
      ["tableBlock", "codeBlock", "viewportBlock"].includes(selectedBlock.type)
    ) {      const node = editor.state.doc.nodeAt(selectedBlock.pos);
      if (!node) {
        return;
      }
      const next = { ...node.attrs, ...patch };
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(selectedBlock.pos, undefined, next),
      );
      setSelectedBlock({
        ...selectedBlock,
        span: Number(next.span ?? 12),
        heightMode: next.heightMode === "fixed" ? "fixed" : "auto",
        heightPx: Number(next.heightPx ?? 240),
        zoom: Math.max(50, Math.min(200, Number(next.zoom ?? 100))),
      });
      return;
    }
    const { from, to } = editor.state.selection;
    if (
      selectedBlock.type === "blockGroup" &&
      (Number(patch.span ?? selectedBlock.span) === 12 ||
        patch.heightMode === "auto")
    ) {
      const node = editor.state.doc.nodeAt(selectedBlock.pos);
      if (node?.type.name === "blockGroup") {
        const children: PMNode[] = [];
        node.forEach((child) => children.push(child));
        if (children.length > 0) {
          editor.view.dispatch(
            editor.state.tr.replaceWith(
              selectedBlock.pos,
              selectedBlock.pos + node.nodeSize,
              Fragment.fromArray(children),
            ),
          );
          setSelectedBlock(null);
        }
      }
      return;
    }
    const nodes: PMNode[] = [];
    const starts: number[] = [];
    let offset = 0;
    let start = -1;
    let end = -1;
    editor.state.doc.forEach((node) => {
      const nodeStart = offset;
      const nodeEnd = nodeStart + node.nodeSize;
      offset = nodeEnd;
      if (nodeEnd <= from || nodeStart >= to) {
        return;
      }
      if (start < 0) {
        start = nodeStart;
      }
      end = nodeEnd;
      nodes.push(node);
      starts.push(nodeStart);
    });
    if (nodes.length === 0 || start < 0) {
      return;
    }
    if (nodes.length === 1) {
      const node = nodes[0];      const next = { ...node.attrs, ...patch };
      const transaction = editor.state.tr.setNodeMarkup(start, undefined, next);
      editor.view.dispatch(transaction);
      setSelectedBlock({
        ...selectedBlock,
        pos: start,
        span: Number(next.span ?? 12),
        heightMode: next.heightMode === "fixed" ? "fixed" : "auto",
        heightPx: Number(next.heightPx ?? 240),
        zoom: Math.max(50, Math.min(200, Number(next.zoom ?? 100))),
      });
      return;
    }

    if (patch.span === 12 || patch.heightMode === "auto") {
      const transaction = editor.state.tr;
      nodes.forEach((node, index) => {
        transaction.setNodeMarkup(starts[index], undefined, {
          ...node.attrs,
          ...(patch.span === 12 ? { span: 12 } : {}),
          ...(patch.heightMode === "auto" ? { heightMode: "auto" } : {}),
        });
      });
      editor.view.dispatch(transaction);
      setSelectedBlock({
        ...selectedBlock,
        pos: starts[0],
        ...(patch.span === 12 ? { span: 12 } : {}),
        ...(patch.heightMode === "auto"
          ? { heightMode: "auto" as const }
          : {}),
      });
      return;
    }
    const groupType = editor.schema.nodes.blockGroup;
    if (!groupType) {
      return;
    }
    const attrs = {
      blockId: `block_${crypto.randomUUID().replace(/-/g, "")}`,
      span: 12,
      heightMode: "auto",
      heightPx: 240,
      ...patch,
    };
    const group = groupType.create(attrs, nodes);
    const transaction = editor.state.tr.replaceWith(start, end, group);
    editor.view.dispatch(transaction);
    setSelectedBlock({
      pos: start,
      type: "blockGroup",
      span: Number(attrs.span ?? 12),
      heightMode: attrs.heightMode === "fixed" ? "fixed" : "auto",
      heightPx: Number(attrs.heightPx ?? 240),
      zoom: Math.max(50, Math.min(200, Number(attrs.zoom ?? 100))),
    });
  };

  const clearAtomPreview = () => {
    previewAtomRef.current?.classList.remove("block-selection-preview");
    previewAtomRef.current = null;
  };

  const previewAtomUnderPointer = (event: MouseEvent<HTMLDivElement>) => {
    if (event.buttons !== 1 || !editor) {
      return;
    }
    if (editor.state.selection.empty) {
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      ".proto-viewport, .proto-table-container, .code-block-shell",
    );
    if (previewAtomRef.current && previewAtomRef.current !== target) {
      clearAtomPreview();
    }
    if (target && !target.classList.contains("block-selected")) {
      target.classList.add("block-selection-preview");
      previewAtomRef.current = target;
    }
  };

  const extendSelectionOverAtom = (event: MouseEvent<HTMLDivElement>) => {
    clearAtomPreview();
    if (!editor) {
      return;
    }
    const target = (event.target as HTMLElement).closest(
      ".proto-viewport, .proto-table-container, .code-block-shell",
    );
    if (!target) {
      return;
    }
    const selection = editor.state.selection;
    if (selection.empty) {
      return;
    }
    let start: number;
    try {
      start = editor.view.posAtDOM(target, 0);
    } catch {
      return;
    }
    const node = editor.state.doc.nodeAt(start);
    if (!node || !node.isAtom) {
      return;
    }
    const end = start + node.nodeSize;
    if (selection.to <= start) {
      editor.commands.setTextSelection({ from: selection.from, to: end });
    } else if (selection.from >= end) {
      editor.commands.setTextSelection({ from: start, to: selection.to });
    }
  };

  return (
    <div className="imported-preview-pane">
      <div
        className="imported-preview-surface"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          const files = [...event.dataTransfer.files].filter((file) =>
            file.type.startsWith("image/"),
          );
          if (files.length === 0) {
            return;
          }
          event.preventDefault();
          files.forEach((file) => insertImageFileRef.current(file));
        }}
        onPaste={(event) => {
          const files = [...event.clipboardData.files].filter((file) =>
            file.type.startsWith("image/"),
          );
          if (files.length === 0) {
            return;
          }
          event.preventDefault();
          files.forEach((file) => insertImageFileRef.current(file));
        }}
        onMouseUp={extendSelectionOverAtom}
        onMouseMove={previewAtomUnderPointer}
        onMouseLeave={clearAtomPreview}
        onMouseDown={clearAtomPreview}
      >
        <div className="block-toolbar-stack">
        {editing && editor && (
          <div className="block-format-toolbar">
            {[
              { label: "↶", title: "撤销", active: "history", run: () => editor.chain().focus().undo().run() },
              { label: "↷", title: "重做", active: "history", run: () => editor.chain().focus().redo().run() },
              { label: "B", title: "粗体", active: "bold", run: () => editor.chain().focus().toggleBold().run() },
              { label: "I", title: "斜体", active: "italic", run: () => editor.chain().focus().toggleItalic().run() },
              { label: "S", title: "删除线", active: "strike", run: () => editor.chain().focus().toggleStrike().run() },
              { label: "</>", title: "行内代码", active: "code", run: () => editor.chain().focus().toggleCode().run() },
              { label: "H1", title: "一级标题", active: "heading", run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
              { label: "H2", title: "二级标题", active: "heading", run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
              { label: "•", title: "无序列表", active: "bulletList", run: () => editor.chain().focus().toggleBulletList().run() },
              { label: "☑", title: "任务列表", active: "taskList", run: () => editor.chain().focus().toggleList("taskList", "taskItem").run() },
              { label: "“", title: "引用", active: "blockquote", run: () => editor.chain().focus().toggleBlockquote().run() },
              { label: "{ }", title: "代码块", active: "codeBlock", run: () => editor.chain().focus().toggleCodeBlock().run() },
              { label: "—", title: "分隔线", active: "horizontalRule", run: () => editor.chain().focus().setHorizontalRule().run() },
              {
                label: "🔗",
                title: "链接",
                active: "link",
                run: () => {
                  setLinkUrl(String(editor.getAttributes("link").href ?? ""));
                  setLinkOpen((current) => !current);
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                title={item.title}
                className={editor.isActive(item.active) ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={item.run}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        {editing && editor && linkOpen && (
          <div className="block-link-popover">
            <input
              autoFocus
              value={linkUrl}
              placeholder="https://…"
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setLinkOpen(false);
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: linkUrl })
                    .run();
                  setLinkOpen(false);
                }
              }}
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: linkUrl })
                  .run();
                setLinkOpen(false);
              }}
            >
              应用
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setLinkOpen(false)}
            >
              取消
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                移除
              </button>
            )}
          </div>
        )}
        {editing && selectedBlock && (
          <div className="block-layout-toolbar">
            <span className="block-layout-label">
              选中块 · {selectedBlock.type}
            </span>
            <button
              type="button"
              title="上移块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => moveBlock(-1)}
            >
              ↑
            </button>
            <button
              type="button"
              title="下移块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => moveBlock(1)}
            >
              ↓
            </button>
            <button
              type="button"
              title="复制块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={duplicateBlock}
            >
              复制
            </button>
            <button
              type="button"
              title="删除块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={deleteBlock}
            >
              删除
            </button>
            {selectedBlock.type === "blockGroup" && (
              <button
                type="button"
                title="解组"
                onMouseDown={(event) => event.preventDefault()}
                onClick={ungroupBlock}
              >
                解组
              </button>
            )}
            <label>
              宽
              <select
                value={selectedBlock.span}
                onChange={(event) =>
                  updateLayout({ span: Number(event.target.value) })
                }
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (span) => (
                    <option key={span} value={span}>
                      {span} 列
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              高
              <select
                value={
                  selectedBlock.heightMode === "fixed"
                    ? String(
                        Math.max(1, Math.round(selectedBlock.heightPx / 28)),
                      )
                    : "auto"
                }
                onChange={(event) => {
                  if (event.target.value === "auto") {
                    updateLayout({ heightMode: "auto" });
                    return;
                  }
                  updateLayout({
                    heightMode: "fixed",
                    heightPx: Math.max(1, Number(event.target.value)) * 28,
                  });
                }}
              >
                <option value="auto">auto</option>
                {Array.from(
                  new Set([
                    ...Array.from({ length: 48 }, (_, index) => index + 1),
                    ...(selectedBlock.heightMode === "fixed"
                      ? [Math.max(1, Math.round(selectedBlock.heightPx / 28))]
                      : []),
                  ]),
                )
                  .sort((a, b) => a - b)
                  .map((lines) => (
                    <option key={lines} value={lines}>
                      {lines} 行
                    </option>
                  ))}
              </select>
            </label>
            <label>
              缩放
              <input
                type="number"
                min={50}
                max={200}
                step={5}
                value={selectedBlock.zoom}
                onChange={(event) =>
                  updateLayout({
                    zoom: Math.max(
                      50,
                      Math.min(200, Number(event.target.value)),
                    ),
                  })
                }
              />
              %
            </label>
          </div>
        )}
        </div>
        <div className="block-document-title-row">
          <div
            className="block-document-title block-document-title-readonly"
            aria-label="文档标题"
          >
            {documentTitle}
          </div>
        </div>
        <EditorContent editor={editor} />
      </div>
      <div className="block-status-bar">
        {saving ? "保存中…" : status} · {stats.blocks} 块 ·{" "}
        {stats.characters.toLocaleString()} 字
      </div>
    </div>
  );
}
