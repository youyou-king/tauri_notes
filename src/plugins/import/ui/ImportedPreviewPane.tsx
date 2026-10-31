import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { createPluginServices } from "../../../application/pluginServices";
import { recordConsoleEvent } from "../../../application/consoleLogStore";
import { importFeature } from "../manifest";
import { flattenMindMap } from "../../../lib/mindMap";
import {
  confirmDialog,
  setPanelStatus,
  useEditorSnapshot,
  usePanelContext,
} from "../../../ui/sdk";
import {
  APP_EVENTS,
  commandEventName,
  emitAppEvent,
  onAppEvent,
} from "../../../kernel/sdk";

const pluginServices = createPluginServices(importFeature);
import { getUiRenderer } from "../../../kernel/sdk";
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
  type ViewportPickRequest,
} from "../../../prototype/blockExtensions";
import { TauriImportedDocumentRepository } from "../../../infrastructure/tauriImportedDocumentRepository";
import { CodeBlockView } from "../../../prototype/codeBlockView";
import { CodeHighlight } from "../../../prototype/codeHighlight";
import { MarkdownInlineRules } from "../../../prototype/markdownInlineRules";
import { BlockSelectionHighlight } from "../../../prototype/selectionHighlight";
import {
  documentToSaveBlocks,
  importedBlocksToDocument,
  resolveImageSource,
  resolveImageSources,
} from "../../../editor/importedMarkdown";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import type { SelectedBlock } from "../../../application/state/editorSnapshot";
import {
  createFormatToolbarItems,
  isFormatActive,
} from "./formatToolbar";
import { LinkPopover } from "./LinkPopover";

function blockSignature(block: {
  orderKey: string;
  contentJson: string;
}): string {
  return `${block.orderKey}|${block.contentJson}`;
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
  panelId,
}: {
  workspaceRoot: string;
  documentId?: string;
  panelId?: string;
}) {
  const repository = useMemo(
    () => new TauriImportedDocumentRepository(workspaceRoot),
    [workspaceRoot],
  );
  const context = usePanelContext();
  const setPanelDirty = context?.setPanelDirty;
  const dirtyKey = panelId ?? documentId;
  const [status, setStatus] = useState("加载文档…");
  const [documentTitle, setDocumentTitle] = useState("");
  const editing = true;
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [viewportRequest, setViewportRequest] =
    useState<ViewportPickRequest | null>(null);
  const selectedRef = useRef("");
  const [editorReady, setEditorReady] = useState(false);
  const editingRef = useRef(true);
  const loadingRef = useRef(true);
  const savedRef = useRef(new Map<string, string>());
  const saveTimer = useRef<number | null>(null);
  const flushSave = useRef<(() => void) | null>(null);
  const insertImageFileRef = useRef<(file: File) => void>(() => {});
  const previewAtomRef = useRef<HTMLElement | null>(null);
  const headingUnderPointerRef = useRef<{
    blockId: string;
    title: string;
  } | null>(null);
  const activeDocumentId = documentId ?? "";

  const markPanelDirty = (dirty: boolean) => {
    if (dirtyKey && setPanelDirty) {
      setPanelDirty(dirtyKey, dirty);
    }
  };

  const markPanelStatus = (
    status: "idle" | "dirty" | "saving" | "saved" | "error",
  ) => {
    if (dirtyKey) {
      setPanelStatus(dirtyKey, status);
    }
  };

  useEffect(() => {
    if (!dirtyKey || !setPanelDirty) {
      return;
    }
    return () => setPanelDirty(dirtyKey, false);
  }, [dirtyKey, setPanelDirty]);

  useEffect(() => {
    if (!activeDocumentId) {
      setDocumentTitle("");
      return;
    }
    let cancelled = false;
    void pluginServices.document
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
      void pluginServices.document
        .getTitle(workspaceRoot, activeDocumentId)
        .then((title) => {
          setDocumentTitle(title);
        })
        .catch(() => {});
    };
    const unsubscribers = [
      onAppEvent(APP_EVENTS.blocksSaved, refresh),
      onAppEvent(APP_EVENTS.documentChanged, refresh),
      onAppEvent(APP_EVENTS.documentRenamed, refresh),
      onAppEvent(APP_EVENTS.mapsChanged, refresh),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
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
      ViewportBlock.configure({
        workspaceRoot,
        onPickViewport: (request: ViewportPickRequest) =>
          setViewportRequest(request),
      }),
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
    onCreate: () => setEditorReady(true),
    onDestroy: () => setEditorReady(false),
    onUpdate: ({ editor: current }) => {
      if (!editingRef.current || loadingRef.current) {
        return;
      }
      setStatus("未保存");
      markPanelDirty(true);
      markPanelStatus("dirty");
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
          markPanelDirty(false);
          markPanelStatus("saved");
          return;
        }
        setSaving(true);
        markPanelStatus("saving");
        void repository
          .saveBlocks(selectedRef.current, changed, deleted)
          .then(() => {
            blocks.forEach((block) =>
              savedRef.current.set(block.id, blockSignature(block)),
            );
            deleted.forEach((id) => savedRef.current.delete(id));
            setStatus("已保存");
            markPanelDirty(false);
            markPanelStatus("saved");
            recordConsoleEvent(
              "document",
              "保存文档",
              selectedRef.current,
            );
            emitAppEvent(APP_EVENTS.blocksSaved, {
              documentId: selectedRef.current,
              blockIds: changed.map((block) => block.id),
              deletedBlockIds: deleted,
            });
          })
          .catch((error) => {
            markPanelDirty(true);
            markPanelStatus("error");
            setStatus(`保存失败：${String(error)}`);
          })
          .finally(() => setSaving(false));
      };
    },
  });

  const editorSnapshot = useEditorSnapshot(editor);
  const selectedBlock = editorSnapshot.selectedBlock;
  const stats = editorSnapshot.stats;

  useEffect(() => {
    editingRef.current = editing;
    if (!editor || !editorReady || editor.isDestroyed) {
      return;
    }
    editor.setEditable(editing);
    // 重建 NodeView，让表格在只读文本和可编辑输入格之间切换。
    editor.commands.setContent(editor.getJSON(), { emitUpdate: false });
  }, [editing, editor, editorReady]);

  useEffect(() => {
    selectedRef.current = activeDocumentId;
  }, [activeDocumentId]);

  useEffect(() => {
    const handler = () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      flushSave.current?.();
    };
    const unsubscribe = onAppEvent(APP_EVENTS.saveNow, handler);
    window.addEventListener("pagehide", handler);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", handler);
    };
  }, []);

  useEffect(() => {
    if (!editor || !editorReady || !activeDocumentId) {
      return;
    }
    let cancelled = false;
    loadingRef.current = true;
    setStatus("加载块…");
    void repository
      .loadBlocks(activeDocumentId)
      .then((blocks) => {
        if (cancelled || editor.isDestroyed) {
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
        editor.view.dom.classList.toggle("large-document", blocks.length > 300);
        setStatus("已加载");
        markPanelDirty(false);
        markPanelStatus("idle");
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
  }, [activeDocumentId, editor, editorReady, repository]);

  const insertImageFile = (file: File) => {
    if (!editor || !editing || !activeDocumentId) {
      return;
    }
    void file
      .arrayBuffer()
      .then(async (buffer) => {
        const note = workspaceRoot.toLowerCase().endsWith(".note");
        const dataUrl = note ? await fileDataUrl(file) : "";
        const relative = await pluginServices.assets.saveImage({
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

  const insertTable = () => {
    if (!editor) {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "tableBlock",
        attrs: {
          markdown: [
            "| 列 1 | 列 2 | 列 3 |",
            "| --- | --- | --- |",
            "|  |  |  |",
            "|  |  |  |",
          ].join("\n"),
        },
      })
      .run();
    setStatus("已插入表格");
    recordConsoleEvent("document", "插入表格");
  };

  const insertEmptyViewport = () => {
    if (!editor) {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "viewportBlock",
        attrs: {
          blockId: `block_${crypto.randomUUID().replace(/-/g, "")}`,
          referenceId: "",
          label: "引用视图",
          targetBlockIds: [],
        },
      })
      .run();
    setStatus("已插入视图，请选择要引用的内容");
    recordConsoleEvent("document", "插入视图");
  };

  useEffect(() => {
    const handler = () => {
      if (editor?.view.hasFocus()) {
        insertEmptyViewport();
      }
    };
    window.addEventListener(
      commandEventName("viewport.pick"),
      handler,
    );
    return () =>
      window.removeEventListener(
        commandEventName("viewport.pick"),
        handler,
      );
  }, [editor]);

  const openHeadingNode = async (event: {
    ctrlKey: boolean;
    target: EventTarget | null;
    preventDefault: () => void;
    clientX: number;
    clientY: number;
  }) => {
    if (!event.ctrlKey || !editor || !context) {
      return;
    }
    let blockId = "";
    let headingTitle = "";
    const pointedHeading = headingUnderPointerRef.current;
    headingUnderPointerRef.current = null;
    if (pointedHeading) {
      blockId = pointedHeading.blockId;
      headingTitle = pointedHeading.title;
    }
    const selectedNode = editor.state.selection.$from.parent;
    if (
      selectedNode.type.name === "heading" &&
      Number(selectedNode.attrs.level) === 1
    ) {
      blockId = String(selectedNode.attrs.blockId ?? "");
      headingTitle = selectedNode.textContent.trim();
    }
    try {
      if (!headingTitle) {
        const coordinates = editor.view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        const position = coordinates
          ? editor.state.doc.resolve(coordinates.pos).parent
          : null;
        if (
          position?.type.name === "heading" &&
          Number(position.attrs.level) === 1
        ) {
          blockId = String(position.attrs.blockId ?? "");
          headingTitle = position.textContent.trim();
        }
      }
    } catch {
      // Fall through to the DOM element below.
    }

    if (!headingTitle) {
      const pointed = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>("h1"))
        .find((element): element is HTMLElement => Boolean(element));
      const target =
        pointed ??
        ((event.target as HTMLElement | null)?.closest?.(
          "h1",
        ) as HTMLElement | null);
      if (
        !target ||
        !editor.view.dom.contains(target) ||
        target.closest(".proto-viewport")
      ) {
        return;
      }
      blockId = target.dataset.blockId ?? "";
      headingTitle = target.textContent?.trim() ?? "";
    }

    if (!headingTitle) {
      return;
    }
    event.preventDefault();
    const mapId =
      context.activeMap?.id ?? activeDocumentId.split("/")[0] ?? "";
    if (!mapId) {
      setStatus("当前标题不属于任何导图");
      return;
    }
    try {
      const map = await pluginServices.maps.loadMap(workspaceRoot, mapId);
      const nodes = flattenMindMap(map.root).filter(
        (item) => item.id !== map.root.id,
      );
      const node =
        (blockId
          ? nodes.find((item) => item.headingBlockId === blockId)
          : undefined) ??
        nodes.find(
          (item) =>
            item.headingBlockId !== null &&
            item.title.trim() === headingTitle,
        );
      if (!node) {
        setStatus(
          "没有找到这个 H1 对应的导图节点，请先保存文档再试",
        );
        return;
      }
      if (node.documentId) {
        if (node.documentId === activeDocumentId) {
          setStatus("这个标题已经对应当前文档");
          return;
        }
        context.onActivateWorkspace(workspaceRoot);
        context.openBlockDocument(
          node.documentId,
          node.title,
          workspaceRoot,
        );
        recordConsoleEvent("document", "跳转 H1 节点", node.title);
        return;
      }
      const confirmed = await confirmDialog({
        title: "创建文档",
        eyebrow: "H1 节点",
        message: (
          <p>
            “<strong>{node.title}</strong>”还没有关联文档。是否为它创建一篇文档？
          </p>
        ),
        confirmLabel: "创建文档",
      });
      if (!confirmed) {
        return;
      }
      setStatus("正在创建文档…");
      const updated = await pluginServices.maps.createDocumentForNode(
        workspaceRoot,
        node.id,
      );
      emitAppEvent(APP_EVENTS.mapsChanged);
      emitAppEvent(APP_EVENTS.documentChanged);
      if (updated.documentId) {
        context.onActivateWorkspace(workspaceRoot);
        context.openBlockDocument(
          updated.documentId,
          updated.title,
          workspaceRoot,
        );
        recordConsoleEvent("document", "创建并打开 H1 文档", updated.title);
      }
    } catch (reason) {
      setStatus(`打开 H1 节点失败：${String(reason)}`);
    }
  };

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
  };

  const updateLayout = (patch: Partial<SelectedBlock>) => {
    if (!editor || !editing || !selectedBlock) {
      return;
    }
    if (
      ["tableBlock", "codeBlock", "viewportBlock"].includes(selectedBlock.type)
    ) {
      const node = editor.state.doc.nodeAt(selectedBlock.pos);
      if (!node) {
        return;
      }
      const next = { ...node.attrs, ...patch };
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(selectedBlock.pos, undefined, next),
      );
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
      const node = nodes[0];
      const next = { ...node.attrs, ...patch };
      const transaction = editor.state.tr.setNodeMarkup(start, undefined, next);
      editor.view.dispatch(transaction);
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

  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) {
      return;
    }
    const listener = (event: globalThis.MouseEvent) => {
      void openHeadingNode(event);
    };
    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("h1");
      if (
        target &&
        editor?.view.dom.contains(target) &&
        !target.closest(".proto-viewport")
      ) {
        headingUnderPointerRef.current = {
          blockId: target.dataset.blockId ?? "",
          title: target.textContent?.trim() ?? "",
        };
      } else {
        headingUnderPointerRef.current = null;
      }
    };
    dom.addEventListener("click", listener, true);
    dom.addEventListener("mousedown", onPointerDown, true);
    return () => {
      dom.removeEventListener("click", listener, true);
      dom.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [activeDocumentId, context, editor, workspaceRoot]);

  const formatItems = editor
    ? createFormatToolbarItems(
        editor,
        editorSnapshot.toolbar,
        insertTable,
        (href) => {
          setLinkUrl(href);
          setLinkOpen((current) => !current);
        },
      )
    : [];

  const ViewportSelectionPanel = getUiRenderer("viewport.selection");

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
            {formatItems.map((item) => {
              const active = isFormatActive(editorSnapshot.toolbar, item.active);
              return (
                <button
                  key={item.label}
                  type="button"
                  title={item.title}
                  className={active ? "active" : ""}
                  aria-pressed={item.active ? active : undefined}
                  disabled={item.disabled ?? false}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={item.run}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              className="block-format-icon-button"
              title="插入视图"
              aria-label="插入视图"
              onMouseDown={(event) => event.preventDefault()}
              onClick={insertEmptyViewport}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2.25" y="3.25" width="11.5" height="9.5" rx="1.5" />
                <path d="M2.25 6.25h11.5M5 3.25v3" />
              </svg>
            </button>
          </div>
        )}
        {editing && editor && linkOpen && (
          <LinkPopover
            editor={editor}
            linkUrl={linkUrl}
            showRemove={editorSnapshot.toolbar.link}
            onLinkUrlChange={setLinkUrl}
            onLinkOpenChange={setLinkOpen}
          />
        )}
        {editing && selectedBlock && (
          <div className="block-layout-toolbar">
            <span className="block-layout-label">
              选中块 · {selectedBlock.type}
            </span>
            <button
              type="button"
              className="block-layout-icon-button"
              aria-label="上移块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => moveBlock(-1)}
            >
              ↑
              <span className="block-layout-tooltip">上移块</span>
            </button>
            <button
              type="button"
              className="block-layout-icon-button"
              aria-label="下移块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => moveBlock(1)}
            >
              ↓
              <span className="block-layout-tooltip">下移块</span>
            </button>
            <button
              type="button"
              className="block-layout-icon-button"
              aria-label="复制块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={duplicateBlock}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="5.25" y="5.25" width="8.25" height="8.25" rx="1.5" />
                <path d="M10.75 5.25V3.5a1.5 1.5 0 0 0-1.5-1.5h-6a1.5 1.5 0 0 0-1.5 1.5v6a1.5 1.5 0 0 0 1.5 1.5h1.75" />
              </svg>
              <span className="block-layout-tooltip">复制块</span>
            </button>
            <button
              type="button"
              className="block-layout-icon-button"
              aria-label="删除块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={deleteBlock}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.75 4.5h10.5" />
                <path d="M6.25 4.5V3a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v1.5" />
                <path d="M4.75 4.5l.5 8a1 1 0 0 0 1 .95h3.5a1 1 0 0 0 1-.95l.5-8" />
                <path d="M6.75 7v3.75M9.25 7v3.75" />
              </svg>
              <span className="block-layout-tooltip">删除块</span>
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
      <div
        className="block-status-bar"
        role="status"
        aria-live="polite"
      >
        {saving ? "保存中…" : status} · {stats.blocks} 块 ·{" "}
        {stats.characters.toLocaleString()} 字
      </div>
      {viewportRequest && ViewportSelectionPanel && (
        <ViewportSelectionPanel
          workspaceRoot={workspaceRoot}
          activeDocumentId={activeDocumentId}
          request={viewportRequest}
          onClose={() => setViewportRequest(null)}
        />
      )}
    </div>
  );
}
