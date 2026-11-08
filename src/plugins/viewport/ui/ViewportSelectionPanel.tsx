import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PanelIcon, StateView, SurfaceHeader } from "../../../ui/sdk";
import { createPluginServices } from "../../../application/pluginServices";
import { viewportFeature } from "../manifest";
import type { LibraryId } from "../../../types";
import {
  createDocumentPreview,
} from "../../../editor/previewEditor";
import { importedBlocksToDocument } from "../../../editor/importedMarkdown";
import type { NodeView } from "../../../types";
import { usePanelContext } from "../../../ui/sdk";
import type { ViewportPickRequest } from "../../../editor/blockExtensions";

const pluginServices = createPluginServices(viewportFeature);

type DocumentOption = {
  id: string;
  title: string;
  mapTitle: string;
};

type LoadedBlock = Awaited<
  ReturnType<typeof pluginServices.document.loadBlocks>
>[number];

type Props = {
  workspaceRoot: string;
  activeDocumentId: string;
  request: ViewportPickRequest;
  onClose: () => void;
};

function collectDocuments(
  node: {
    id: string;
    title: string;
    hasDocument: boolean;
    children: unknown[];
  },
  mapId: string,
  mapTitle: string,
  output: DocumentOption[],
) {
  if (node.hasDocument) {
    output.push({
      id: `${mapId}/${node.id}`,
      title: node.title,
      mapTitle,
    });
  }
  for (const child of node.children as typeof node[]) {
    collectDocuments(child, mapId, mapTitle, output);
  }
}

export function ViewportSelectionPanel({
  workspaceRoot,
  activeDocumentId,
  request,
  onClose,
}: Props) {
  const context = usePanelContext();
  const libraryId: LibraryId = (() => {
    const id =
      context?.workspaces.find((item) => item.root === workspaceRoot)?.id ??
      context?.workspace?.id;
    if (!id) {
      throw new Error("书库上下文缺失");
    }
    return id;
  })();
  const documents = useMemo(() => {
    const output: DocumentOption[] = [];
    for (const workspace of context?.workspaces ?? []) {
      for (const map of workspace.maps) {
        collectDocuments(map.root, map.id, map.title, output);
      }
    }
    if (output.length === 0 && activeDocumentId) {
      output.push({
        id: activeDocumentId,
        title: "当前文档",
        mapTitle: "当前",
      });
    }
    return output;
  }, [activeDocumentId, context?.workspaces]);

  const initialSourceId =
    request.sourceDocumentId ??
    (documents.some((item) => item.id === activeDocumentId)
      ? activeDocumentId
      : documents[0]?.id ?? activeDocumentId);
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [blocks, setBlocks] = useState<LoadedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(request.selectedIds);
  const hadSelection = request.selectedIds.length > 0;
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const hostRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<ReturnType<typeof createDocumentPreview> | null>(
    null,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlocks([]);
    void pluginServices.document
      .loadBlocks(libraryId, sourceId)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setBlocks(
          loaded.filter(
            (block) =>
              block.id !== request.excludeBlockId &&
              block.blockType !== "viewport" &&
              block.blockType !== "group",
          ),
        );
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(String(reason));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request.excludeBlockId, sourceId, libraryId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    if (loading || error) {
      return;
    }
    previewRef.current?.destroy();
    previewRef.current = null;
    host.replaceChildren();
    if (blocks.length === 0) {
      return;
    }
    const editor = createDocumentPreview(workspaceRoot, host, libraryId);
    editor.view.dom.classList.add(
      "block-prototype-prosemirror",
      "imported-preview",
      "viewport-selection-document",
    );
    editor.commands.setContent(
      importedBlocksToDocument(
        blocks.map((block, index) => ({
          id: block.id,
          documentId: block.documentId,
          blockType: block.blockType,
          orderKey: String(index).padStart(8, "0"),
          widthSpan: block.widthSpan,
          heightMode: block.heightMode,
          heightPx: block.heightPx,
          contentJson: block.contentJson,
          plainText: block.plainText,
        })),
      ),
    );
    previewRef.current = editor;
    return () => {
      editor.destroy();
      if (previewRef.current === editor) {
        previewRef.current = null;
      }
    };
  }, [blocks, error, loading, workspaceRoot, libraryId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    host
      .querySelectorAll<HTMLElement>(".ProseMirror > [data-block-id]")
      .forEach((element) => {
        const id = element.dataset.blockId ?? "";
        element.classList.toggle("viewport-selection-selected", selected.includes(id));
      });
  }, [blocks, loading, selected]);

  const captureSelection = () => {
    const host = hostRef.current;
    const selection = window.getSelection();
    if (!host || !selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!host.contains(range.commonAncestorContainer)) {
      return;
    }
    const nodes = [
      ...host.querySelectorAll<HTMLElement>(
        ".ProseMirror > [data-block-id]",
      ),
    ];
    let ids: string[];
    if (selection.isCollapsed) {
      const anchor =
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement;
      const block = anchor?.closest<HTMLElement>("[data-block-id]");
      const id = block?.dataset.blockId ?? "";
      if (!id) {
        return;
      }
      ids = [id];
    } else {
      ids = nodes
        .filter((element) => range.intersectsNode(element))
        .map((element) => element.dataset.blockId ?? "")
        .filter(Boolean);
    }
    if (ids.length === 0) {
      return;
    }
    const currentDocumentIds = new Set(blocks.map((block) => block.id));
    setSelected((current) => [
      ...current.filter((id) => !currentDocumentIds.has(id)),
      ...ids,
    ]);
    setNotice("");
  };

  const sourceTitle =
    documents.find((document) => document.id === sourceId)?.title ??
    sourceId.split("/").slice(1).join("/");

  const toggleOutlineNode = (key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderOutlineNode = (
    node: NodeView,
    mapId: string,
    depth: number,
  ): ReactNode => {
    const key = `${mapId}/${node.id}`;
    const expanded = !collapsed.has(key);
    return (
      <div key={key}>
        <div
          className={`tree-row outline-node ${
            node.hasDocument ? "document" : "idea"
          } ${key === sourceId ? "selected" : ""}`}
          style={{ paddingLeft: `${4 + depth * 13}px` }}
        >
          <button
            type="button"
            className="tree-caret-button"
            aria-label={expanded ? "收起" : "展开"}
            onClick={(event) => {
              event.stopPropagation();
              if (node.children.length > 0) {
                toggleOutlineNode(key);
              }
            }}
          >
            {node.children.length > 0 ? (expanded ? "▾" : "▸") : "·"}
          </button>
          <span className="outline-icon">
            <PanelIcon icon={node.hasDocument ? "📄" : "💡"} />
          </span>
          <button
            type="button"
            className="tree-label"
            title={node.hasDocument ? "选择此文档" : "纯想法节点"}
            onClick={() => {
              if (node.hasDocument) {
                setSourceId(key);
              } else if (node.children.length > 0) {
                toggleOutlineNode(key);
              }
            }}
          >
            {node.title}
          </button>
        </div>
        {expanded &&
          node.children.map((child) =>
            renderOutlineNode(child, mapId, depth + 1),
          )}
      </div>
    );
  };

  return createPortal(
    <div className="viewport-selection-root">
      <aside
        className="viewport-selection-panel"
        role="complementary"
        aria-label="选择引用内容"
      >
        <SurfaceHeader
          className="viewport-selection-header"
          eyebrow="引用选择"
          title="选择要引用的内容"
          titleAs="h2"
          onClose={onClose}
          closeLabel="关闭引用选择"
          closeClassName="viewport-selection-close"
        />

        <div className="viewport-selection-body">
          <nav className="viewport-selection-outline" aria-label="文档大纲">
            {context?.workspaces.length ? (
              context.workspaces.flatMap((workspace) =>
                workspace.maps.map((map) => (
                  <div
                    key={`${workspace.root}:${map.id}`}
                    className="viewport-selection-map"
                  >
                    <div className="viewport-selection-map-title">
                      <span>🗺</span>
                      {map.title}
                    </div>
                    {map.root.children.map((node) =>
                      renderOutlineNode(node, map.id, 0),
                    )}
                  </div>
                )),
              )
            ) : documents.length === 0 ? (
              <p className="viewport-selection-muted">正在读取大纲…</p>
            ) : (
              documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  className={`viewport-selection-doc ${
                    document.id === sourceId ? "active" : ""
                  }`}
                  title={document.title}
                  onClick={() => setSourceId(document.id)}
                >
                  <span>{document.title}</span>
                  <small>{document.mapTitle}</small>
                </button>
              ))
            )}
          </nav>

          <section className="viewport-selection-main">
            <div className="viewport-selection-doc-head">
              <div>
                <strong>{sourceTitle}</strong>
                <span>按住左键拖动选择要引用的内容</span>
              </div>
            </div>

            <div
              className="viewport-selection-document"
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
            >
              <div ref={hostRef} />
              {loading && (
                <StateView
                  className="viewport-selection-empty"
                  tone="loading"
                  detail="正在读取内容…"
                />
              )}
              {!loading && error && (
                <StateView
                  className="viewport-selection-error"
                  tone="error"
                  detail={error}
                />
              )}
              {!loading && !error && blocks.length === 0 && (
                <StateView
                  className="viewport-selection-empty"
                  detail="这个文档没有可引用的内容。"
                />
              )}
            </div>
          </section>
        </div>

        <footer className="viewport-selection-footer">
          <div className="viewport-selection-chips">
            <span className="viewport-selection-count">
              已选 {selected.length} 段
            </span>
            {notice && (
              <span className="viewport-selection-notice">{notice}</span>
            )}
            {selected.length > 0 && (
              <button
                type="button"
                className="viewport-selection-clear"
                onClick={() => setSelected([])}
              >
                清空
              </button>
            )}
          </div>
          <div className="viewport-selection-actions">
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (selected.length === 0 && !hadSelection) {
                  setNotice("请先在文档中按住左键拖动选择内容");
                  return;
                }
                try {
                  request.apply(selected);
                  onClose();
                } catch (reason) {
                  setNotice(String(reason));
                }
              }}
            >
              {selected.length === 0 && hadSelection ? "清空视图" : "添加引用"}
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
