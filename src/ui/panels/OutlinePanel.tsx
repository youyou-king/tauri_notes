import { useContext, useEffect, useRef, useState } from "react";
import { APP_EVENTS, emitAppEvent, onAppEvent } from "../../kernel/events";
import { mapService } from "../../application/mapService";
import { documentService } from "../../application/documentService";
import { crossPanelBus } from "../../kernel/event";
import { confirmDialog } from "../dialog/appDialog";
import { Dialog } from "../dialog/Dialog";
import type { LibraryId, MindMapNode, OutlineView } from "../../types";
import { ContextMenu, type ContextMenuItem } from "../menu/ContextMenu";
import { PanelContext } from "./PanelContext";
import { OutlineTreeNode } from "../outline/OutlineTreeNode";
import { createOutlineDragDrop } from "../outline/outlineDragDrop";

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

  const roots = (context?.workspaces ?? []).map((item) => item.root);
  const libraryIdForRoot = (rootPath: string): LibraryId => {
    const id =
      context?.workspaces.find((item) => item.root === rootPath)?.id ??
      context?.workspace?.id;
    if (!id) {
      throw new Error("书库上下文缺失");
    }
    return id;
  };
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
        view: await mapService.loadOutline(item.id),
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
    const unsubscribers = [
      onAppEvent(APP_EVENTS.blocksSaved, handler),
      onAppEvent(APP_EVENTS.documentChanged, handler),
      onAppEvent(APP_EVENTS.mapsChanged, handler),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
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
    emitAppEvent(APP_EVENTS.mapsChanged, { root: rootPath });
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
        context.onRenameWorkspace(libraryIdForRoot(rename.rootPath), title);
      } else if (rename.kind === "map" && rename.mapId) {
        await mapService.renameMap(
          libraryIdForRoot(rename.rootPath),
          rename.mapId,
          title,
        );
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
        await mapService.renameNode(
          libraryIdForRoot(rename.rootPath),
          rename.nodeId,
          title,
        );
        if (targetDocument) {
          emitAppEvent(APP_EVENTS.documentRenamed, {
            documentId: targetDocument,
            title,
          });
        }
        notify(rename.rootPath);
      } else if (rename.kind === "doc" && rename.documentId) {
        await documentService.rename(
          libraryIdForRoot(rename.rootPath),
          rename.documentId,
          title,
        );
        emitAppEvent(APP_EVENTS.documentRenamed, {
          documentId: rename.documentId,
          title,
        });
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
        await mapService.createMap(
          libraryIdForRoot(dialog.rootPath),
          title,
        );
      } else if (dialog.mapId) {
        await mapService.renameMap(
          libraryIdForRoot(dialog.rootPath),
          dialog.mapId,
          title,
        );
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
      !(await confirmDialog({
        title: "删除导图？",
        message: `删除导图“${title}”？导图里的文档会移动到“未归类”。`,
        confirmLabel: "删除",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await mapService.deleteMap(libraryIdForRoot(rootPath), mapId);
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
      await mapService.renameNode(
        libraryIdForRoot(rootPath),
        node.id,
        title,
      );
      if (node.documentId) {
        emitAppEvent(APP_EVENTS.documentRenamed, {
          documentId: node.documentId,
          title,
        });
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
      !(await confirmDialog({
        title: "绑定已有文档？",
        message: `节点“${target.title}”已有文档，源文档内容会追加到末尾，随后删除源文档。继续？`,
        confirmLabel: "继续绑定",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await mapService.bindDocument(
        libraryIdForRoot(rootPath),
        nodeId,
        documentId,
      );
      notify(rootPath);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const menuItems: ContextMenuItem[] = !menu
    ? []
    : menu.kind === "root"
      ? [
          {
            id: "create-map",
            label: "新建导图…",
            onSelect: () => {
              setDialog({
                mode: "create",
                rootPath: menu.rootPath,
                value: "未命名导图",
              });
            },
          },
          {
            id: "rename-root",
            label: "重命名知识库…",
            onSelect: () => {
              setRename({
                kind: "root",
                rootPath: menu.rootPath,
                value:
                  context?.workspaces.find(
                    (item) => item.root === menu.rootPath,
                  )?.title ?? "",
              });
            },
          },
          {
            id: "unload-root",
            label: "卸载知识库",
            danger: true,
            separatorBefore: true,
            onSelect: () => {
              const rootPath = menu.rootPath;
              void confirmDialog({
                title: "卸载知识库？",
                message: "卸载这个知识库？不会删除 .note 文件。",
                confirmLabel: "卸载",
                tone: "danger",
              }).then((confirmed) => {
                if (confirmed) {
                  context?.onUnloadWorkspace(libraryIdForRoot(rootPath));
                }
              });
            },
          },
        ]
      : menu.kind === "map"
        ? [
            {
              id: "rename-map",
              label: "重命名导图…",
              onSelect: () => {
                setRename({
                  kind: "map",
                  rootPath: menu.rootPath,
                  mapId: menu.mapId,
                  value: menu.mapTitle ?? "",
                });
              },
            },
            {
              id: "delete-map",
              label: "删除导图…",
              danger: true,
              separatorBefore: true,
              onSelect: () => void deleteMap(),
            },
          ]
        : [
            {
              id: "rename-document",
              label: "重命名文档…",
              onSelect: () => {
                setRename({
                  kind: "doc",
                  rootPath: menu.rootPath,
                  documentId: menu.documentId,
                  value: menu.documentTitle ?? "",
                });
              },
            },
            {
              id: "delete-document",
              label: "删除文档…",
              danger: true,
              separatorBefore: true,
              onSelect: () => {
                if (!menu.documentId) {
                  return;
                }
                const documentId = menu.documentId;
                const rootPath = menu.rootPath;
                void confirmDialog({
                  title: "删除文档？",
                  message: "删除这个未归类文档？",
                  confirmLabel: "删除",
                  tone: "danger",
                }).then((confirmed) => {
                  if (!confirmed) {
                    return;
                  }
                  void documentService
                    .delete(libraryIdForRoot(rootPath), documentId)
                    .then(() => {
                      emitAppEvent(APP_EVENTS.documentDeleted, {
                        libraryId: libraryIdForRoot(rootPath),
                        documentId,
                      });
                      notify(rootPath);
                    })
                    .catch((reason) => setError(String(reason)));
                });
              },
            },
          ];

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
                            onClick={() =>
                              context.onSwitchMap(map, libraryIdForRoot(root))
                            }
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
                              context.onActivateWorkspace(libraryIdForRoot(root));
                              context.openBlockDocument(
                                documentId,
                                undefined,
                                libraryIdForRoot(root),
                              );
                            }}
                            dragDrop={createOutlineDragDrop(
                              node.id,
                              (nodeId, sourceRoot, documentId) =>
                                bindDocument(
                                  root,
                                  nodeId,
                                  sourceRoot,
                                  documentId,
                                ),
                            )}
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
                    const payload = {
                      kind: "document" as const,
                      root: document.root,
                      documentId: document.documentId,
                      title: document.title,
                    };
                    crossPanelBus.startDrag(payload, "outline");
                    crossPanelBus.write(event.dataTransfer, payload);
                    event.dataTransfer.setData(
                      "application/x-note-document",
                      JSON.stringify({
                        root: document.root,
                        documentId: document.documentId,
                      }),
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={() => crossPanelBus.endDrag()}
                  onClick={() => {
                    if (unfiledTimer.current !== null) {
                      window.clearTimeout(unfiledTimer.current);
                    }
                    const documentId = document.documentId;
                    const rootPath = document.root;
                    unfiledTimer.current = window.setTimeout(() => {
                      unfiledTimer.current = null;
                      context.onActivateWorkspace(libraryIdForRoot(rootPath));
                      context.openBlockDocument(
                        documentId,
                        undefined,
                        libraryIdForRoot(rootPath),
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
        <ContextMenu
          position={{ x: menu.x, y: menu.y }}
          items={menuItems}
          onClose={() => setMenu(null)}
          label="大纲菜单"
        />
      )}
      {dialog && (
        <Dialog
          title={dialog.mode === "create" ? "新建导图" : "重命名导图"}
          onClose={() => setDialog(null)}
          width={420}
          footer={
            <>
              <button type="button" onClick={() => setDialog(null)}>
                取消
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void submitDialog()}
              >
                确定
              </button>
            </>
          }
        >
          <input
            className="outline-dialog-input"
            data-autofocus
            value={dialog.value}
            onChange={(event) =>
              setDialog((current) =>
                current ? { ...current, value: event.target.value } : current,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void submitDialog();
              }
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

