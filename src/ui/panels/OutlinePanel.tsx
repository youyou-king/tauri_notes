import { useContext, useEffect, useRef, useState } from "react";
import { mapService } from "../../application/mapService";
import { documentService } from "../../application/documentService";
import type { MindMapNode, OutlineView } from "../../types";
import { PanelContext } from "./PanelContext";

export function OutlineTreeNode({
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

export function MultiOutlinePanel() {
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

