import {
  lazy,
  Suspense,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  DockviewReact,
  themeAbyss,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import MindMap from "./MindMap";
import BoardView from "../ui/board/BoardView";
import DocumentLibraryPane from "../ui/library/DocumentLibraryPane";
import { PanelShell } from "../ui/panels/PanelShell";
import {
  getPanelComponents,
  getPanelIcon,
  registerPanel,
} from "../ui/panels/registry";
const ImportedPreviewPane = lazy(
  () => import("../ui/import/ImportedPreviewPane"),
);
import { mapService } from "../application/mapService";
import { documentService } from "../application/documentService";
import type { BoardController } from "../ui/board/useBoardController";
import type {
  MapView,
  MindMapNode,
  NodeView,
  OutlineView,
  WorkspaceView,
} from "../types";

type MapParams = {
  mapId?: string;
  workspaceRoot?: string;
};

type BlockDocParams = {
  documentId?: string;
  workspaceRoot?: string;
};

export type PinBlockInput = {
  blockId: string;
  docId: string;
  docTitle: string;
  text: string;
};

type PanelContextValue = {
  workspace: WorkspaceView | null;
  workspaces: WorkspaceView[];
  activeMap: MapView | null;
  activePanelId: string | null;
  selected: NodeView | null;
  logs: string[];
  openDocument: (mapId: string, nodeId: string, title?: string) => void;
  openBlockDocument: (
    documentId: string,
    title?: string,
    workspaceRoot?: string,
  ) => void;
  setPanelDirty: (panelId: string, dirty: boolean) => void;
  onSelectNode: (node: NodeView, newPanel: boolean) => void;
  onSwitchMap: (map: MapView, workspaceRoot?: string) => void;
  onActivateWorkspace: (root: string) => void;
  onUnloadWorkspace: (root: string) => void;
  onRenameWorkspace: (root: string, title: string) => void;
  onPinBlock: (input: PinBlockInput) => void | Promise<void>;
  board: BoardController;
  lastActiveDocId: string | null;
};

const PanelContext = createContext<PanelContextValue | null>(null);

export const DOCK_LAYOUT_KEY = "tauri-notes.dock-layout.v21";

export type DockWorkspaceHandle = {
  openDocument: (
    mapId: string,
    nodeId: string,
    title?: string,
    workspaceRoot?: string,
  ) => void;
  openMap: (mapId: string, workspaceRoot?: string) => void;
  openBoard: () => void;
  openBlockDocument: (
    documentId: string,
    title?: string,
    workspaceRoot?: string,
  ) => void;
  openLibrary: () => void;
  togglePanel: (panelId: string) => void;
  closeWorkspacePanels: (
    workspaceRoot: string,
    workspace?: WorkspaceView | null,
  ) => void;
  resetLayout: () => void;
};

function findNode(node: NodeView, id: string): NodeView | null {
  if (node.id === id) {
    return node;
  }
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

function OutlineTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onOpenDocument,
  onDropDocument,
  onRenameDocument,
  activeDocumentId,
}: {
  node: MindMapNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpenDocument: (documentId: string) => void;
  onDropDocument: (
    nodeId: string,
    sourceRoot: string,
    documentId: string,
  ) => void;
  onRenameDocument: (node: MindMapNode, title: string) => void;
  activeDocumentId: string | null;
}) {
  const [dropActive, setDropActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const openTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
      }
    };
  }, []);
  const hasChildren = node.children.length > 0;
  const open = expanded.has(node.id) || !hasChildren;
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== node.title) {
      onRenameDocument(node, next);
    } else {
      setDraft(node.title);
    }
  };
  return (
    <div className="outline-branch">
      <div
        className={`tree-row outline-node ${
          node.hasDocument ? "document" : "idea"
        } ${node.documentId === activeDocumentId ? "selected" : ""} ${
          dropActive ? "drop-target" : ""
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("application/x-note-document")) {
            event.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropActive(false);
          const raw = event.dataTransfer.getData(
            "application/x-note-document",
          );
          if (!raw) {
            return;
          }
          try {
            const payload = JSON.parse(raw) as {
              root?: string;
              documentId?: string;
            };
            if (payload.documentId) {
              onDropDocument(
                node.id,
                payload.root ?? "",
                payload.documentId,
              );
            }
          } catch {
            // ignore invalid drag payload
          }
        }}
      >
        <button
          type="button"
          className="tree-caret-button"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) {
              onToggle(node.id);
            }
          }}
          aria-label={open ? "收起" : "展开"}
        >
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </button>
        <span className="outline-icon">
          {node.hasDocument ? "📄" : "💡"}
        </span>
        {editing ? (
          <input
            autoFocus
            className="tree-label-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commit();
              } else if (event.key === "Escape") {
                setDraft(node.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="tree-label"
            title={node.hasDocument ? "打开文档" : "纯想法节点"}
            onClick={() => {
              if (node.hasDocument && node.documentId) {
                if (openTimer.current !== null) {
                  window.clearTimeout(openTimer.current);
                }
                const documentId = node.documentId;
                openTimer.current = window.setTimeout(() => {
                  openTimer.current = null;
                  onOpenDocument(documentId);
                }, 220);
              } else if (hasChildren) {
                onToggle(node.id);
              }
            }}
            onDoubleClick={() => {
              if (openTimer.current !== null) {
                window.clearTimeout(openTimer.current);
                openTimer.current = null;
              }
              setDraft(node.title);
              setEditing(true);
            }}
          >
            {node.title}
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div className="tree-children">
          {node.children.map((child) => (
            <OutlineTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpenDocument={onOpenDocument}
              onDropDocument={onDropDocument}
              onRenameDocument={onRenameDocument}
              activeDocumentId={activeDocumentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MultiOutlinePanel() {
  const context = useContext(PanelContext);
  const [outlines, setOutlines] = useState<
    Array<{ root: string; view: OutlineView }>
  >([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    kind: "root" | "map" | "unfiled";
    rootPath: string;
    mapId?: string;
    mapTitle?: string;
    documentId?: string;
    documentTitle?: string;
  } | null>(null);
  const [dialog, setDialog] = useState<{
    mode: "create" | "rename";
    rootPath: string;
    mapId?: string;
    value: string;
  } | null>(null);
  const [rename, setRename] = useState<{
    kind: "root" | "map" | "doc";
    rootPath: string;
    mapId?: string;
    nodeId?: string;
    documentId?: string;
    value: string;
  } | null>(null);
  const initialized = useRef(false);
  const unfiledTimer = useRef<number | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".mind-map-menu")) {
        setMenu(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const roots = (context?.workspaces ?? []).map((item) => item.root);
  const unfiledDocs = outlines.flatMap(({ root, view }) =>
    view.unfiled.map((document) => ({ root, ...document })),
  );
  const load = () => {
    if (!context || context.workspaces.length === 0) {
      setOutlines([]);
      return;
    }
    void Promise.all(
      context.workspaces.map(async (item) => ({
        root: item.root,
        view: await mapService.loadOutline(item.root),
      })),
    )
      .then((next) => {
        setOutlines(next);
        setError(null);
        if (!initialized.current) {
          initialized.current = true;
          const ids = new Set<string>();
          const collect = (node: MindMapNode) => {
            ids.add(node.id);
            node.children.forEach(collect);
          };
          next.forEach(({ root, view }) => {
            ids.add(`fs:${root}`);
            view.maps.forEach((map) => {
              ids.add(map.id);
              map.root.children.forEach(collect);
            });
          });
          setExpanded(ids);
        }
      })
      .catch((reason) => setError(String(reason)));
  };

  useEffect(() => {
    initialized.current = false;
    load();
    const handler = () => load();
    window.addEventListener("tauri-notes:blocks-saved", handler);
    window.addEventListener("tauri-notes:document-changed", handler);
    window.addEventListener("tauri-notes:maps-changed", handler);
    return () => {
      window.removeEventListener("tauri-notes:blocks-saved", handler);
      window.removeEventListener("tauri-notes:document-changed", handler);
      window.removeEventListener("tauri-notes:maps-changed", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots.join("|")]);

  if (!context) {
    return null;
  }

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const notify = (rootPath: string) => {
    window.dispatchEvent(
      new CustomEvent("tauri-notes:maps-changed", {
        detail: { root: rootPath },
      }),
    );
    load();
  };

  const submitRename = async () => {
    if (!rename) {
      return;
    }
    const title = rename.value.trim();
    if (!title) {
      return;
    }
    try {
      if (rename.kind === "root") {
        context.onRenameWorkspace(rename.rootPath, title);
      } else if (rename.kind === "map" && rename.mapId) {
        await mapService.renameMap(rename.rootPath, rename.mapId, title);
        notify(rename.rootPath);
      } else if (rename.kind === "doc" && rename.nodeId) {
        const targetDocument = outlines
          .flatMap((item) => item.view.maps)
          .flatMap((map) => {
            const collect = (nodes: MindMapNode[]): MindMapNode[] =>
              nodes.flatMap((node) => [node, ...collect(node.children)]);
            return collect(map.root.children);
          })
          .find((node) => node.id === rename.nodeId)?.documentId;
        await mapService.renameNode(rename.rootPath, rename.nodeId, title);
        if (targetDocument) {
          window.dispatchEvent(
            new CustomEvent("tauri-notes:document-renamed", {
              detail: { documentId: targetDocument, title },
            }),
          );
        }
        notify(rename.rootPath);
      } else if (rename.kind === "doc" && rename.documentId) {
        await documentService.rename(
          rename.rootPath,
          rename.documentId,
          title,
        );
        window.dispatchEvent(
          new CustomEvent("tauri-notes:document-renamed", {
            detail: { documentId: rename.documentId, title },
          }),
        );
        notify(rename.rootPath);
      }
      setRename(null);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const submitDialog = async () => {    if (!dialog) {
      return;
    }
    const title = dialog.value.trim();
    if (!title) {
      return;
    }
    try {
      if (dialog.mode === "create") {
        await mapService.createMap(dialog.rootPath, title);
      } else if (dialog.mapId) {
        await mapService.renameMap(dialog.rootPath, dialog.mapId, title);
      }
      setDialog(null);
      notify(dialog.rootPath);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const deleteMap = async () => {
    if (!menu?.mapId) {
      return;
    }
    const rootPath = menu.rootPath;
    const mapId = menu.mapId;
    const title = menu.mapTitle ?? "导图";
    setMenu(null);
    if (
      !window.confirm(
        `删除导图“${title}”？\n导图里的文档会移动到“未归类”。`,
      )
    ) {
      return;
    }
    try {
      await mapService.deleteMap(rootPath, mapId);
      notify(rootPath);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const renameDocumentNode = async (
    rootPath: string,
    node: MindMapNode,
    title: string,
  ) => {
    try {
      await mapService.renameNode(rootPath, node.id, title);
      if (node.documentId) {
        window.dispatchEvent(
          new CustomEvent("tauri-notes:document-renamed", {
            detail: { documentId: node.documentId, title },
          }),
        );
      }
      notify(rootPath);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const bindDocument = async (
    rootPath: string,
    nodeId: string,
    sourceRoot: string,
    documentId: string,
  ) => {
    if (sourceRoot && sourceRoot !== rootPath) {
      setError("不能把另一个知识库的文档拖到当前导图");
      return;
    }
    const findTarget = (nodes: MindMapNode[]): MindMapNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          return node;
        }
        const nested = findTarget(node.children);
        if (nested) {
          return nested;
        }
      }
      return null;
    };
    const sourceOutline = outlines.find((item) => item.root === rootPath);
    const target = sourceOutline
      ? findTarget(
          sourceOutline.view.maps.flatMap((map) => map.root.children),
        )
      : null;
    if (
      target?.documentId &&
      target.documentId !== documentId &&
      !window.confirm(
        `节点“${target.title}”已有文档，源文档内容会追加到末尾，随后删除源文档。继续？`,
      )
    ) {
      return;
    }
    try {
      await mapService.bindDocument(rootPath, nodeId, documentId);
      notify(rootPath);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <div className="outline-panel">
      {error && <div className="outline-error">{error}</div>}
      <div className="tree outline-tree">
        {outlines.map(({ root, view }) => {
          const rootOpen = expanded.has(`fs:${root}`);
          const workspaceTitle =
            context.workspaces.find((item) => item.root === root)?.title ??
            view.title;
          return (
            <div key={root} className="outline-workspace">
              <div
                className={`tree-row outline-root ${
                  context.workspace?.root === root ? "selected" : ""
                }`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    kind: "root",
                    rootPath: root,
                  });
                }}
              >
                <button
                  type="button"
                  className="tree-caret-button"
                  onClick={() => toggle(`fs:${root}`)}
                  aria-label={rootOpen ? "收起" : "展开"}
                >
                  {rootOpen ? "▾" : "▸"}
                </button>
                <span className="outline-icon">📚</span>
                {rename?.kind === "root" && rename.rootPath === root ? (
                  <input
                    autoFocus
                    className="tree-label-input"
                    value={rename.value}
                    onChange={(event) =>
                      setRename((current) =>
                        current
                          ? { ...current, value: event.target.value }
                          : current,
                      )
                    }
                    onBlur={() => void submitRename()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void submitRename();
                      } else if (event.key === "Escape") {
                        setRename(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="tree-label"
                    onClick={() => toggle(`fs:${root}`)}
                    onDoubleClick={() =>
                      setRename({
                        kind: "root",
                        rootPath: root,
                        value: workspaceTitle,
                      })
                    }
                  >
                    {workspaceTitle}
                  </button>
                )}
              </div>
              {rootOpen &&
                view.maps.map((map) => {
                  const mapOpen = expanded.has(map.id);
                  return (
                    <div key={map.id} className="outline-map">
                      <div
                        className={`tree-row outline-map-row ${
                          context.workspace?.root === root &&
                          map.id === context.activeMap?.id
                            ? "selected"
                            : ""
                        }`}
                        style={{ paddingLeft: "22px" }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setMenu({
                            x: event.clientX,
                            y: event.clientY,
                            kind: "map",
                            rootPath: root,
                            mapId: map.id,
                            mapTitle: map.title,
                          });
                        }}
                      >
                        <button
                          type="button"
                          className="tree-caret-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggle(map.id);
                          }}
                          aria-label={mapOpen ? "收起" : "展开"}
                        >
                          {map.root.children.length > 0
                            ? mapOpen
                              ? "▾"
                              : "▸"
                            : "·"}
                        </button>
                        <span className="outline-icon">🌳</span>
                        {rename?.kind === "map" &&
                        rename.rootPath === root &&
                        rename.mapId === map.id ? (
                          <input
                            autoFocus
                            className="tree-label-input"
                            value={rename.value}
                            onChange={(event) =>
                              setRename((current) =>
                                current
                                  ? { ...current, value: event.target.value }
                                  : current,
                              )
                            }
                            onBlur={() => void submitRename()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                void submitRename();
                              } else if (event.key === "Escape") {
                                setRename(null);
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="tree-label map-label"
                            title="打开导图"
                            onClick={() => context.onSwitchMap(map, root)}
                            onDoubleClick={() =>
                              setRename({
                                kind: "map",
                                rootPath: root,
                                mapId: map.id,
                                value: map.title,
                              })
                            }
                          >
                            {map.title}
                          </button>
                        )}
                      </div>
                      {mapOpen &&
                        map.root.children.map((node) => (
                          <OutlineTreeNode
                            key={node.id}
                            node={node}
                            depth={2}
                            expanded={expanded}
                            onToggle={toggle}
                            onOpenDocument={(documentId) => {
                              context.onActivateWorkspace(root);
                              context.openBlockDocument(
                                documentId,
                                undefined,
                                root,
                              );
                            }}
                            onDropDocument={(nodeId, sourceRoot, documentId) =>
                              bindDocument(root, nodeId, sourceRoot, documentId)
                            }
                            onRenameDocument={(node, title) =>
                              void renameDocumentNode(root, node, title)
                            }
                            activeDocumentId={context.lastActiveDocId}
                          />
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}
        {unfiledDocs.length > 0 && (
          <div className="outline-unfiled outline-unfiled-global">
            <div className="tree-row outline-unfiled-row">
              <button
                type="button"
                className="tree-caret-button"
                onClick={() => toggle("unfiled:all")}
              >
                {expanded.has("unfiled:all") ? "▾" : "▸"}
              </button>
              <span className="outline-icon">📥</span>
              <button
                type="button"
                className="tree-label"
                onClick={() => toggle("unfiled:all")}
              >
                未归类
              </button>
              <span className="outline-count">{unfiledDocs.length}</span>
            </div>
            {expanded.has("unfiled:all") &&
              unfiledDocs.map((document) => (
                <div
                  key={`${document.root}:${document.documentId}`}
                  className="tree-row outline-unfiled-doc"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-note-document",
                      JSON.stringify({
                        root: document.root,
                        documentId: document.documentId,
                      }),
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => {
                    if (unfiledTimer.current !== null) {
                      window.clearTimeout(unfiledTimer.current);
                    }
                    const documentId = document.documentId;
                    const rootPath = document.root;
                    unfiledTimer.current = window.setTimeout(() => {
                      unfiledTimer.current = null;
                      context.onActivateWorkspace(rootPath);
                      context.openBlockDocument(
                        documentId,
                        undefined,
                        rootPath,
                      );
                    }, 220);
                  }}
                  onDoubleClick={() => {
                    if (unfiledTimer.current !== null) {
                      window.clearTimeout(unfiledTimer.current);
                      unfiledTimer.current = null;
                    }
                    setRename({
                      kind: "doc",
                      rootPath: document.root,
                      documentId: document.documentId,
                      value: document.title,
                    });
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({
                      x: event.clientX,
                      y: event.clientY,
                      kind: "unfiled",
                      rootPath: document.root,
                      documentId: document.documentId,
                      documentTitle: document.title,
                    });
                  }}
                  style={{ paddingLeft: "30px" }}
                >
                  <span className="outline-icon">📄</span>
                  {rename?.kind === "doc" &&
                  rename.documentId === document.documentId ? (
                    <input
                      autoFocus
                      className="tree-label-input"
                      value={rename.value}
                      onChange={(event) =>
                        setRename((current) =>
                          current
                            ? { ...current, value: event.target.value }
                            : current,
                        )
                      }
                      onBlur={() => void submitRename()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void submitRename();
                        } else if (event.key === "Escape") {
                          setRename(null);
                        }
                      }}
                    />
                  ) : (
                    <span className="tree-label">{document.title}</span>
                  )}
                </div>
              ))}
          </div>
        )}
        {outlines.length === 0 && !error && (
          <div className="empty-tree">加载大纲…</div>
        )}
      </div>
      {menu && (
        <div
          className="mind-map-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menu.kind === "root" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  setDialog({
                    mode: "create",
                    rootPath: menu.rootPath,
                    value: "未命名导图",
                  });
                }}
              >
                新建导图…
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  setRename({
                    kind: "root",
                    rootPath: menu.rootPath,
                    value:
                      context.workspaces.find(
                        (item) => item.root === menu.rootPath,
                      )?.title ?? "",
                  });
                }}
              >
                重命名知识库…
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  if (
                    window.confirm(
                      "卸载这个知识库？不会删除 .note 文件。",
                    )
                  ) {
                    context.onUnloadWorkspace(menu.rootPath);
                  }
                }}
              >
                卸载知识库
              </button>
            </>
          ) : menu.kind === "map" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  setRename({
                    kind: "map",
                    rootPath: menu.rootPath,
                    mapId: menu.mapId,
                    value: menu.mapTitle ?? "",
                  });
                }}
              >
                重命名导图…
              </button>
              <button type="button" onClick={() => void deleteMap()}>
                删除导图…
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  setRename({
                    kind: "doc",
                    rootPath: menu.rootPath,
                    documentId: menu.documentId,
                    value: menu.documentTitle ?? "",
                  });
                }}
              >
                重命名文档…
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!menu.documentId) {
                    return;
                  }
                  const documentId = menu.documentId;
                  const rootPath = menu.rootPath;
                  setMenu(null);
                  if (!window.confirm("删除这个未归类文档？")) {
                    return;
                  }
                  void documentService
                    .delete(rootPath, documentId)
                    .then(() => {
                      window.dispatchEvent(
                        new CustomEvent("tauri-notes:document-deleted", {
                          detail: { root: rootPath, documentId },
                        }),
                      );
                      notify(rootPath);
                    })
                    .catch((reason) => setError(String(reason)));
                }}
              >
                删除文档…
              </button>
            </>
          )}
        </div>
      )}
      {dialog && (
        <div
          className="outline-dialog-backdrop"
          onMouseDown={() => setDialog(null)}
        >
          <div
            className="outline-dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <strong>
              {dialog.mode === "create" ? "新建导图" : "重命名导图"}
            </strong>
            <input
              autoFocus
              value={dialog.value}
              onChange={(event) =>
                setDialog((current) =>
                  current ? { ...current, value: event.target.value } : current,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void submitDialog();
                } else if (event.key === "Escape") {
                  setDialog(null);
                }
              }}
            />
            <div className="outline-dialog-actions">
              <button type="button" onClick={() => setDialog(null)}>
                取消
              </button>
              <button type="button" onClick={() => void submitDialog()}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapPanel(props: IDockviewPanelProps<MapParams>) {
  const context = useContext(PanelContext);
  if (!context) {
    return null;
  }
  const requestedRoot = props.params?.workspaceRoot;
  const mapWorkspace =
    context.workspaces.find((item) => item.root === requestedRoot) ??
    context.workspace;
  const paramMap = props.params?.mapId
    ? mapWorkspace?.maps.find((item) => item.id === props.params?.mapId)
    : null;
  const map =
    paramMap ?? context.activeMap ?? mapWorkspace?.maps[0] ?? null;
  useEffect(() => {
    if (map) {
      props.api.setTitle(map.title);
    }
  }, [map?.title, props.api]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ mapId?: string; title?: string }>
      ).detail;
      if (detail?.mapId === map?.id && detail.title) {
        props.api.setTitle(detail.title);
      }
    };
    window.addEventListener("tauri-notes:map-renamed", handler);
    return () =>
      window.removeEventListener("tauri-notes:map-renamed", handler);
  }, [map?.id, props.api]);
  if (map && mapWorkspace) {
    return (
      <MindMap
        workspaceRoot={mapWorkspace.root}
        mapId={map.id}
        mapTitle={map.title}
        selectedId={context.selected?.id ?? null}
        onOpenDocument={(documentId) =>
          context.openBlockDocument(documentId, undefined, mapWorkspace.root)
        }
      />
    );
  }
  return (
    <div className="map-placeholder">
      <span>▦</span>
      <p>打开一个 `.notes` 知识库</p>
    </div>
  );
}

function ConsolePanel() {
  const context = useContext(PanelContext);
  if (!context) {
    return null;
  }
  return (
    <PanelShell
      className="console-panel"
      bodyClassName="console-body"
      title="控制台"
      icon="⌨"
      status="就绪"
    >
      <div className="console-lines">
        {context.logs.map((line, index) => (
          <div key={index} className="console-line">
            <span className="console-prompt">›</span> {line}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function BoardPanel(props: IDockviewPanelProps) {
  const context = useContext(PanelContext);
  if (!context) {
    return null;
  }
  return (
    <BoardView
      controller={context.board}
      targetDocId={context.lastActiveDocId}
      onClose={props.api.close}
      onOpenSource={(docId) => {
        const separator = docId.indexOf("/");
        if (separator <= 0) {
          return;
        }
        context.openDocument(
          docId.slice(0, separator),
          docId.slice(separator + 1),
        );
      }}
    />
  );
}

function BlockDocumentPanel(props: IDockviewPanelProps<BlockDocParams>) {
  const context = useContext(PanelContext);
  const documentId = props.params.documentId;
  const workspaceRoot =
    props.params.workspaceRoot ?? context?.workspace?.root ?? "";
  const documentWorkspace = context?.workspaces.find(
    (item) => item.root === workspaceRoot,
  );
  useEffect(() => {
    if (!workspaceRoot || !documentId) {
      return;
    }
    const refresh = () => {
      void documentService
        .getTitle(workspaceRoot, documentId)
        .then((title) => props.api.setTitle(title))
        .catch(() => {});
    };
    refresh();
    window.addEventListener("tauri-notes:document-renamed", refresh);
    window.addEventListener("tauri-notes:maps-changed", refresh);
    return () => {
      window.removeEventListener("tauri-notes:document-renamed", refresh);
      window.removeEventListener("tauri-notes:maps-changed", refresh);
    };
  }, [workspaceRoot, documentId, props.api]);
  useEffect(() => {
    if (!documentWorkspace || !documentId) {
      return;
    }
    const [mapId, nodeId] = documentId.split("/");
    const map = documentWorkspace.maps.find((item) => item.id === mapId);
    const node = map && nodeId ? findNode(map.root, nodeId) : null;
    if (node) {
      props.api.setTitle(node.title);
    }
  }, [documentWorkspace, documentId, props.api]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ documentId?: string; title?: string }>
      ).detail;
      if (detail?.documentId === documentId && detail.title) {
        props.api.setTitle(detail.title);
      }
    };
    window.addEventListener("tauri-notes:document-renamed", handler);
    return () =>
      window.removeEventListener("tauri-notes:document-renamed", handler);
  }, [documentId, props.api]);

  if (!workspaceRoot || !documentId) {
    return null;
  }
  return (
    <Suspense
      fallback={<div className="panel-loading">加载编辑器…</div>}
    >
      <ImportedPreviewPane
        workspaceRoot={workspaceRoot}
        documentId={documentId}
      />
    </Suspense>
  );
}

function DocumentLibraryPanel() {
  const context = useContext(PanelContext);
  if (!context?.workspace || !context.activeMap) {
    return null;
  }
  return (
    <DocumentLibraryPane
      workspaceRoot={context.workspace.root}
      mapId={context.activeMap.id}
    />
  );
}

registerPanel({
  id: "outline",
  component: MultiOutlinePanel,
  icon: "🗂",
  defaultTitle: "大纲",
  singleton: true,
});
registerPanel({
  id: "map",
  component: MapPanel,
  icon: "🌳",
  defaultTitle: "导图",
});
registerPanel({
  id: "console",
  component: ConsolePanel,
  icon: "⌨",
  defaultTitle: "控制台",
  singleton: true,
});
registerPanel({
  id: "board",
  component: BoardPanel,
  icon: "🧩",
  defaultTitle: "对照板",
  singleton: true,
});
registerPanel({
  id: "library",
  component: DocumentLibraryPanel,
  icon: "📚",
  defaultTitle: "文档库",
  singleton: true,
});
registerPanel({
  id: "blockdoc",
  component: BlockDocumentPanel,
  icon: "📄",
  defaultTitle: "文档",
});

const components = getPanelComponents() as any;

function WorkspaceTab(props: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(props.api.title);
  const icon = getPanelIcon(props.api.component);

  useEffect(() => {
    const disposable = props.api.onDidTitleChange((event) => {
      setTitle(event.title);
    });
    return () => disposable.dispose();
  }, [props.api]);

  return (
    <div className="workspace-tab">
      <span className="workspace-tab-title">
        {icon && <span className="workspace-tab-icon">{icon}</span>}
        {title}
      </span>
      <button
        type="button"
        className="workspace-tab-close"
        title="关闭面板"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          props.api.close();
        }}
      >
        ×
      </button>
    </div>
  );
}

export default forwardRef<
  DockWorkspaceHandle,
  {
    workspace: WorkspaceView | null;
    workspaces: WorkspaceView[];
    activeMap: MapView | null;
    selected: NodeView | null;
    logs: string[];
    onActiveNode: (node: NodeView) => void;
    onPanelDirty: (panelId: string, dirty: boolean) => void;
    onSelectNode: (node: NodeView, newPanel: boolean) => void;
    onSwitchMap: (map: MapView, workspaceRoot?: string) => void;
    onActivateWorkspace: (root: string) => void;
    onUnloadWorkspace: (root: string) => void;
    onRenameWorkspace: (root: string, title: string) => void;
    onPinBlock: (input: PinBlockInput) => void | Promise<void>;
    board: BoardController;
  }
>(function DockWorkspace(
  {
    workspace,
    workspaces,
    activeMap,
    selected,
    logs,
    onActiveNode,
    onPanelDirty,
    onSelectNode,
    onSwitchMap,
    onActivateWorkspace,
    onUnloadWorkspace,
    onRenameWorkspace,
    onPinBlock,
    board,
  },
  ref,
) {
  const apiRef = useRef<DockviewApi | null>(null);
  const pendingOpen = useRef<{
    mapId: string;
    nodeId: string;
  } | null>(null);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [lastActiveDocId, setLastActiveDocId] = useState<string | null>(null);

  useEffect(() => {
    const api = apiRef.current;
    const panel = api?.getPanel("map");
    if (panel && !panel.api.getParameters<MapParams>().mapId) {
      panel.api.setTitle(activeMap?.title ?? "导图");
    }
  }, [activeMap?.title]);

  function resolveNodeById(docId: string): NodeView | null {
    const [mapId, nodeId] = docId.split("/");
    const map = workspace?.maps.find((item) => item.id === mapId);
    return map && nodeId ? findNode(map.root, nodeId) : null;
  }

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !workspace) {
      return;
    }
    api.panels.forEach((panel) => {
      if (!panel.id.startsWith("blockdoc_")) {
        return;
      }
      const documentId =
        panel.api.getParameters<BlockDocParams>()?.documentId;
      if (!documentId) {
        return;
      }
      const node = resolveNodeById(documentId);
      if (node) {
        panel.api.setTitle(node.title);
      }
    });
  }, [workspace]);

  function applyDefaultPaneSizes(api: DockviewApi) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        api.getPanel("outline")?.group.api.setSize({ width: 240 });
        api.getPanel("map")?.group.api.setSize({ width: 320 });
      });
    });
  }

  function openDocument(
    mapId: string,
    nodeId: string,
    title?: string,
    workspaceRoot?: string,
  ) {
    const api = apiRef.current;
    if (!api) {
      pendingOpen.current = { mapId, nodeId };
      return;
    }
    openBlockDocument(`${mapId}/${nodeId}`, title, workspaceRoot);
  }

  function openMap(mapId: string, workspaceRoot?: string) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const targetWorkspace =
      workspaces.find((item) => item.root === workspaceRoot) ?? workspace;
    const map = targetWorkspace?.maps.find((item) => item.id === mapId);
    const title = map?.title ?? "导图";
    const params: MapParams = { mapId, workspaceRoot: targetWorkspace?.root };
    const mapPanels = api.panels.filter(
      (panel) => panel.api.component === "map",
    );
    const matching = mapPanels.find(
      (panel) =>
        panel.api.getParameters<MapParams>().mapId === mapId &&
        panel.api.getParameters<MapParams>().workspaceRoot ===
          targetWorkspace?.root,
    );
    if (matching) {
      matching.api.updateParameters(params);
      matching.api.setTitle(title);
      matching.api.setActive();
      return;
    }
    const unbound = mapPanels.find(
      (panel) => !panel.api.getParameters<MapParams>().mapId,
    );
    if (unbound) {
      unbound.api.updateParameters(params);
      unbound.api.setTitle(title);
      unbound.api.setActive();
      return;
    }

    const panelId = `map_${(targetWorkspace?.root ?? "").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    )}_${mapId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const existing = api.getPanel(panelId);
    if (existing) {
      existing.api.updateParameters(params);
      existing.api.setTitle(title);
      existing.api.setActive();
      return;
    }
    const reference = api.activePanel?.id;
    const panel = api.addPanel({
      id: panelId,
      component: "map",
      title,
      params,
      ...(reference
        ? {
            position: {
              referencePanel: reference,
              direction: "right" as const,
            },
            initialWidth: 420,
          }
        : {}),
    });
    panel.api.setActive();
  }

  function openBoard() {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const existing = api.getPanel("board");
    if (existing) {
      existing.api.setActive();
      return;
    }
    const reference = api.activePanel?.id ?? api.getPanel("outline")?.id;
    const panel = api.addPanel({
      id: "board",
      component: "board",
      title: "对照板",
      ...(reference
        ? {
            position: {
              referencePanel: reference,
              direction: "right" as const,
            },
            initialWidth: 520,
          }
        : {}),
    });
    panel.api.setActive();
  }

  function openBlockDocument(
    documentId: string,
    knownTitle?: string,
    workspaceRoot?: string,
  ) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const targetRoot = workspaceRoot ?? workspace?.root ?? "";
    const panelId = `blockdoc_${targetRoot.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    )}_${documentId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const targetWorkspace = workspaces.find(
      (item) => item.root === targetRoot,
    );
    const [mapId, nodeId] = documentId.split("/");
    const map = targetWorkspace?.maps.find((item) => item.id === mapId);
    const node = map && nodeId ? findNode(map.root, nodeId) : null;
    const title = knownTitle ?? node?.title ?? documentId;
    const existing = api.getPanel(panelId);
    if (existing) {
      existing.api.setTitle(title);
      existing.api.setActive();
      return;
    }
    api.addPanel({
      id: panelId,
      component: "blockdoc",
      title: title,
      params: { documentId, workspaceRoot: targetRoot },
    });
  }

  function openLibrary() {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const existing = api.getPanel("library");
    if (existing) {
      existing.api.setActive();
      return;
    }
    api.addPanel({
      id: "library",
      component: "library",
      title: "文档库",
    });
  }

  function togglePanel(panelId: string) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const existing = api.getPanel(panelId);
    if (existing) {
      existing.api.setActive();
      return;
    }
    if (panelId === "outline") {
      api.addPanel({
        id: "outline",
        component: "outline",
        title: "大纲",
        position: { direction: "left" },
      });
    } else if (panelId === "console") {
      api.addPanel({
        id: "console",
        component: "console",
        title: "控制台",
        position: { direction: "below" },
      });
    }
  }

  function closeOrphanMapPanels(api: DockviewApi) {
    const valid = new Set<string>();
    for (const item of workspaces) {
      for (const map of item.maps) {
        valid.add(`${item.root}\u0000${map.id}`);
      }
    }
    for (const panel of [...api.panels]) {
      if (panel.api.component !== "map") {
        continue;
      }
      const params = panel.api.getParameters<MapParams>();
      if (!params.mapId) {
        continue;
      }
      const root = params.workspaceRoot ?? workspace?.root ?? "";
      if (!valid.has(`${root}\u0000${params.mapId}`)) {
        panel.api.close();
      }
    }
  }

  useEffect(() => {
    const api = apiRef.current;
    if (api) {
      closeOrphanMapPanels(api);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, workspace?.root]);

  function closeWorkspacePanels(
    workspaceRoot: string,
    targetWorkspace?: WorkspaceView | null,
  ) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const mapIds = new Set(
      (targetWorkspace?.maps ?? []).map((map) => map.id),
    );
    const isActiveRoot = workspace?.root === workspaceRoot;
    for (const panel of [...api.panels]) {
      const params = panel.api.getParameters<{
        workspaceRoot?: string;
        mapId?: string;
        documentId?: string;
      }>();
      if (panel.api.component === "map") {
        const belongs =
          params.workspaceRoot === workspaceRoot ||
          (params.mapId ? mapIds.has(params.mapId) : isActiveRoot);
        if (belongs) {
          panel.api.close();
        }
        continue;
      }
      if (panel.api.component === "blockdoc") {
        const [mapId] = (params.documentId ?? "").split("/");
        const belongs =
          params.workspaceRoot === workspaceRoot ||
          (mapId ? mapIds.has(mapId) : false) ||
          (isActiveRoot && !params.workspaceRoot);
        if (belongs) {
          panel.api.close();
        }
      }
    }
  }

  function resetLayout() {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    for (const panel of [...api.panels]) {
      panel.api.close();
    }
    buildDefaultLayout(api);
  }

  useImperativeHandle(ref, () => ({
    openDocument,
    openMap,
    openBoard,
    openBlockDocument,
    openLibrary,
    togglePanel,
    closeWorkspacePanels,
    resetLayout,
  }));

  function buildDefaultLayout(api: DockviewApi) {
    api.addPanel({
      id: "outline",
      component: "outline",
      title: "大纲",
    });
    api.addPanel({
      id: "map",
      component: "map",
      title: activeMap?.title ?? "导图",
      position: { referencePanel: "outline", direction: "right" },
      initialWidth: 380,
      inactive: true,
    });

    try {
      api.addPanel({
        id: "console",
        component: "console",
        title: "控制台",
        position: { referencePanel: "map", direction: "within" },
        inactive: true,
      });
    } catch {
      // 导图面板不可用时，控制台作为独立面板追加。
      api.addPanel({
        id: "console",
        component: "console",
        title: "控制台",
      });
    }

    requestAnimationFrame(() => {
      api.getPanel("outline")?.group.api.setSize({ width: 260 });
      api.getPanel("map")?.group.api.setSize({ width: 380 });
    });
  }

  function onReady(event: DockviewReadyEvent) {
    apiRef.current = event.api;

    const saved = window.localStorage.getItem(DOCK_LAYOUT_KEY);
    if (saved) {
      try {
        event.api.fromJSON(JSON.parse(saved));
      } catch {
        window.localStorage.removeItem(DOCK_LAYOUT_KEY);
      }
    }

    if (event.api.panels.length === 0) {
      buildDefaultLayout(event.api);
    }
    closeOrphanMapPanels(event.api);

    setActivePanelId(event.api.activePanel?.id ?? null);

    event.api.onDidLayoutChange(() => {
      window.localStorage.setItem(
        DOCK_LAYOUT_KEY,
        JSON.stringify(event.api.toJSON()),
      );
    });

    event.api.onDidActivePanelChange((event) => {
      const panel = event.panel;
      setActivePanelId(panel?.id ?? null);
      if (panel?.id.startsWith("blockdoc_")) {
        const params = panel.api.getParameters<BlockDocParams>();
        const documentId = params?.documentId;
        if (documentId) {
          setLastActiveDocId(documentId);
          const node = resolveNodeById(documentId);
          if (node) {
            onActiveNode(node);
          }
        }
      }
    });

    const pending = pendingOpen.current;
    if (pending) {
      pendingOpen.current = null;
      openDocument(pending.mapId, pending.nodeId);
    }
    applyDefaultPaneSizes(event.api);
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ root?: string; documentId?: string }>
      ).detail;
      const api = apiRef.current;
      if (!api || !detail?.documentId) {
        return;
      }
      for (const panel of [...api.panels]) {
        if (panel.api.component !== "blockdoc") {
          continue;
        }
        const params = panel.api.getParameters<{
          workspaceRoot?: string;
          documentId?: string;
        }>();
        if (
          params.documentId === detail.documentId &&
          (!detail.root || params.workspaceRoot === detail.root)
        ) {
          panel.api.close();
        }
      }
    };
    window.addEventListener("tauri-notes:document-deleted", handler);
    return () =>
      window.removeEventListener("tauri-notes:document-deleted", handler);
  }, []);

  const contextValue: PanelContextValue = {
    workspace,
    workspaces,
    activeMap,
    activePanelId,
    selected,
    logs,
    openDocument,
    openBlockDocument,
    setPanelDirty: onPanelDirty,
    onSelectNode,
    onSwitchMap,
    onActivateWorkspace,
    onUnloadWorkspace,
    onRenameWorkspace,
    onPinBlock,
    board,
    lastActiveDocId,
  };

  return (
    <PanelContext.Provider value={contextValue}>
      <DockviewReact
        className="dock-workspace"
        theme={themeAbyss}
        components={components}
        defaultTabComponent={WorkspaceTab}
        onReady={onReady}
        dndStrategy="html5"
      />
    </PanelContext.Provider>
  );
});

