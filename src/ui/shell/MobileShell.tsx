import { Suspense, useEffect, useState } from "react";
import { documentService } from "../../application/documentService";
import { useMobileShellStore } from "../../application/stores/mobileShellStore";
import { confirmDialog } from "../dialog/confirmDialog";
import { MobileActionSheet } from "./MobileActionSheet";
import { useLongPress } from "../interaction/useLongPress";
import { useSwipeBack } from "../interaction/useSwipeBack";
import { useSwipeLeft } from "../interaction/useSwipeLeft";
import type { MobileTab } from "../../application/stores/mobileShellStore";
import type { StoredBlock } from "../../domain/importedDocument";
import type { BoardControllerPort } from "../../kernel/panel/boardPort";
import { getUiRenderer } from "../../kernel/sdk";
import {
  applyKeymap,
  createInputRouter,
  listActions,
} from "../../kernel/action";
import { useKeymapStore } from "../../application/stores/keymapStore";
import { runCommandById } from "../../kernel/command";
import { renderMarkdownHtml } from "../sdk";
import {
  PanelContext,
  type PanelContextValue,
} from "../panels/PanelContext";
import MindMap from "../../components/MindMap";
import type { MapView, NodeView, WorkspaceView } from "../../types";
import { shellActions } from "./shellActions";
import { APP_EVENTS, emitAppEvent, onAppEvent } from "../../kernel/events";

type MobileDocumentLink = {
  id: string;
  title: string;
};

function collectDocuments(
  node: NodeView,
  mapId: string,
  output: MobileDocumentLink[],
): void {
  if (node.hasDocument) {
    output.push({ id: `${mapId}/${node.id}`, title: node.title });
  }
  for (const child of node.children) {
    collectDocuments(child, mapId, output);
  }
}

function MobileDocumentView({
  workspaceRoot,
  documentId,
}: {
  workspaceRoot: string;
  documentId: string;
}) {
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<StoredBlock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      documentService.getTitle(workspaceRoot, documentId),
      documentService.loadBlocks(workspaceRoot, documentId),
    ])
      .then(([nextTitle, nextBlocks]) => {
        if (cancelled) {
          return;
        }
        setTitle(nextTitle);
        setBlocks(nextBlocks);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, workspaceRoot]);

  return (
    <article className="mobile-document">
      <h1>{title || "文档"}</h1>
      {error && <p className="theme-error">{error}</p>}
      {blocks.map((block) => (
        <div
          key={block.id}
          className="mobile-document-block"
          dangerouslySetInnerHTML={{
            __html: renderMarkdownHtml(block.plainText),
          }}
        />
      ))}
    </article>
  );
}

function MobileLibraryRow({
  document,
  onOpen,
  onMenu,
}: {
  document: MobileDocumentLink;
  onOpen: (id: string) => void;
  onMenu: (document: MobileDocumentLink) => void;
}) {
  const press = useLongPress({
    onLongPress: () => onMenu(document),
  });
  const swipe = useSwipeLeft({ onSwipe: () => onMenu(document) });
  return (
    <button
      type="button"
      className="mobile-pressable"
      {...press}
      onPointerDown={(event) => {
        press.onPointerDown(event);
        swipe.onPointerDown(event);
      }}
      onPointerUp={(event) => {
        press.onPointerUp();
        swipe.onPointerUp(event);
      }}
      onPointerCancel={() => {
        press.onPointerCancel();
        swipe.onPointerCancel();
      }}
      onPointerLeave={() => {
        press.onPointerLeave();
        swipe.onPointerLeave();
      }}
      onClick={() => onOpen(document.id)}
    >
      <strong>{document.title}</strong>
      <span>{document.id}</span>
    </button>
  );
}

export function MobileShell({
  workspace,
  activeMap,
  selected,
  board,
}: {
  workspace: WorkspaceView | null;
  activeMap: MapView | null;
  selected: NodeView | null;
  board: BoardControllerPort;
}) {
  const {
    tab,
    documentId,
    editing,
    hydrate,
    setTab: setStoredTab,
    openDocument: openStoredDocument,
    back,
    history,
    reset: resetMobile,
    setEditing,
  } = useMobileShellStore();
  const keymap = useKeymapStore((state) => state.document);
  const loadKeymap = useKeymapStore((state) => state.load);
  const [menuDocument, setMenuDocument] =
    useState<MobileDocumentLink | null>(null);
  const map = activeMap ?? workspace?.maps[0] ?? null;
  const swipeBack = useSwipeBack({
    onBack: () => {
      if (editing) {
        emitAppEvent(APP_EVENTS.saveNow);
      }
      back();
    },
    edgeOnly: editing,
  });

  useEffect(() => {
    void loadKeymap();
    return onAppEvent(APP_EVENTS.keymapChanged, () => {
      void loadKeymap();
    });
  }, [loadKeymap]);

  useEffect(() => {
    hydrate(workspace?.root ?? null);
  }, [hydrate, workspace?.root]);

  useEffect(() => {
    return onAppEvent(APP_EVENTS.openBlockDocument, (documentId) => {
      if (documentId) {
        const current = useMobileShellStore.getState();
        if (current.editing) {
          emitAppEvent(APP_EVENTS.saveNow);
        }
        current.openDocument(documentId);
      }
    });
  }, []);

  if (!workspace || !map) {
    return (
      <div className="mobile-shell mobile-shell-empty">
        <p>请先打开一个知识库。</p>
      </div>
    );
  }

  const requestSave = () => {
    if (editing) {
      emitAppEvent(APP_EVENTS.saveNow);
    }
  };

  const switchTab = (next: MobileTab) => {
    if (next !== tab) {
      requestSave();
    }
    setStoredTab(next);
  };

  const openDocument = (id: string) => {
    requestSave();
    openStoredDocument(id);
  };


  const renameDocument = async (document: MobileDocumentLink) => {
    const next = window.prompt("重命名文档", document.title)?.trim();
    if (!next || next === document.title) {
      return;
    }
    try {
      await documentService.rename(workspace.root, document.id, next);
      emitAppEvent(APP_EVENTS.documentRenamed, {
        documentId: document.id,
        title: next,
      });
      emitAppEvent(APP_EVENTS.documentChanged);
    } catch (error) {
      window.alert(String(error));
    }
  };

  const deleteDocument = async (document: MobileDocumentLink) => {
    const confirmed = await confirmDialog({
      title: "删除文档？",
      message: `“${document.title}”会移到回收站，可稍后恢复。`,
      confirmLabel: "移到回收站",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    try {
      await documentService.delete(workspace.root, document.id);
      emitAppEvent(APP_EVENTS.documentDeleted, {
        documentId: document.id,
        root: workspace.root,
      });
      emitAppEvent(APP_EVENTS.documentChanged);
      if (documentId === document.id) {
        requestSave();
        if (!back()) {
          resetMobile();
        }
      }
    } catch (error) {
      window.alert(String(error));
    }
  };

  const runMobileCommand = (id: string) => {
    void runCommandById(id, {
      hasWorkspace: true,
      openSettings: shellActions.openSettings,
      openSearch: shellActions.openSearch,
      openBoard: shellActions.openBoard,
      openHelp: shellActions.openHelp,
    }).then((result) => {
      if (!result.ok) {
        console.error(`Mobile action ${id} failed`, result.error);
      }
    });
  };
  const actionRuntime = {
    hasWorkspace: true,
    runCommand: runMobileCommand,
  };
  const actionRouter = createInputRouter({
    platform: "mobile",
    actions: applyKeymap(listActions(), keymap),
  });
  const runMobileAction = (surface: string) => {
    requestSave();
    return actionRouter.triggerSurface(surface, actionRuntime);
  };

  const documents: MobileDocumentLink[] = [];
  collectDocuments(map.root, map.id, documents);

  const DocumentView = getUiRenderer("document.importedView");
  const panelContext: PanelContextValue = {
    workspace,
    workspaces: [workspace],
    activeMap: map,
    activePanelId: null,
    selected,
    openDocument: (mapId, nodeId) => openDocument(`${mapId}/${nodeId}`),
    openBlockDocument: (id) => openDocument(id),
    setPanelDirty: () => {},
    onSelectNode: () => {},
    onSwitchMap: () => {},
    onActivateWorkspace: () => {},
    onUnloadWorkspace: () => {},
    onRenameWorkspace: () => {},
    onPinBlock: () => {},
    board,
    lastActiveDocId: documentId,
  };

  return (
    <div className="mobile-shell">
      <header className="mobile-shell-header">
        {history.length > 0 && (
          <button
            type="button"
            aria-label="返回"
            onClick={() => {
              requestSave();
              back();
            }}
          >
            返回
          </button>
        )}
        <div>
          <strong>
            {tab === "map"
              ? map.title
              : tab === "library"
                ? "目录"
                : "文档"}
          </strong>
          <span>{workspace.title}</span>
        </div>
        <div className="mobile-shell-actions" style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => runMobileAction("search.open")}>
            鎼滅储
          </button>
          <button type="button" onClick={() => runMobileAction("help.open")}>
            甯姪
          </button>
          <button type="button" onClick={() => runMobileAction("board.open")}>
            鐪嬫澘
          </button>
          <button type="button" onClick={() => runMobileAction("theme.open")}>
            涓婚
          </button>
        </div>
      </header>

      <div className="mobile-shell-content">
        {tab === "map" ? (
          <MindMap
            workspaceRoot={workspace.root}
            mapId={map.id}
            mapTitle={map.title}
            selectedId={selected?.id ?? null}
            onOpenDocument={openDocument}
          />
        ) : tab === "library" ? (
          documents.length > 0 ? (
            <div className="mobile-library">
              {documents.map((document) => (
                <MobileLibraryRow
                  key={document.id}
                  document={document}
                  onOpen={openDocument}
                  onMenu={setMenuDocument}
                />
              ))}
            </div>
          ) : (
            <div className="mobile-shell-empty">
              <p>当前导图还没有文档。</p>
            </div>
          )
        ) : documentId ? (
          <div className="mobile-document-shell" {...swipeBack}>
            <div className="mobile-document-actions">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      emitAppEvent(APP_EVENTS.saveNow)
                    }
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      emitAppEvent(APP_EVENTS.saveNow);
                      setEditing(false);
                    }}
                  >
                    完成
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setEditing(true)}>
                  编辑
                </button>
              )}
            </div>
            {editing && DocumentView ? (
              <PanelContext.Provider value={panelContext}>
                <Suspense
                  fallback={
                    <div className="panel-loading">加载编辑器…</div>
                  }
                >
                  <DocumentView
                    workspaceRoot={workspace.root}
                    documentId={documentId}
                  />
                </Suspense>
              </PanelContext.Provider>
            ) : (
              <MobileDocumentView
                workspaceRoot={workspace.root}
                documentId={documentId}
              />
            )}
          </div>
        ) : (
          <div className="mobile-shell-empty">
            <p>从导图或目录打开一篇文档。</p>
          </div>
        )}
      </div>

      <nav className="mobile-tabbar" aria-label="移动导航">
        <button
          type="button"
          className={tab === "map" ? "active" : ""}
          aria-current={tab === "map" ? "page" : undefined}
          onClick={() => switchTab("map")}
        >
          导图
        </button>
        <button
          type="button"
          className={tab === "library" ? "active" : ""}
          aria-current={tab === "library" ? "page" : undefined}
          onClick={() => switchTab("library")}
        >
          目录
        </button>
        <button
          type="button"
          className={tab === "document" ? "active" : ""}
          aria-current={tab === "document" ? "page" : undefined}
          onClick={() => switchTab("document")}
          disabled={!documentId}
        >
          文档
        </button>
        <button
          type="button"
          onClick={() => runMobileAction("settings.open")}
        >
          设置
        </button>
      </nav>

      {menuDocument && (
        <MobileActionSheet
          title={menuDocument.title}
          onClose={() => setMenuDocument(null)}
          items={[
            {
              id: "open",
              label: "打开",
              onSelect: () => {
                openDocument(menuDocument.id);
                setMenuDocument(null);
              },
            },
            {
              id: "rename",
              label: "重命名",
              onSelect: () => {
                void renameDocument(menuDocument).finally(() =>
                  setMenuDocument(null),
                );
              },
            },
            {
              id: "delete",
              label: "移到回收站",
              tone: "danger",
              onSelect: () => {
                void deleteDocument(menuDocument);
                setMenuDocument(null);
              },
            },
          ]}
        />
      )}
    </div>
  );
}
