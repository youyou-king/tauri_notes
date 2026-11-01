import { Suspense, useEffect, useState } from "react";
import {
  managedLibraryService,
  type ManagedLibrarySummary,
} from "../../application/managedLibraryService";
import { useMobileShellStore } from "../../application/stores/mobileShellStore";
import { MobileActionSheet } from "./MobileActionSheet";
import { useSwipeBack } from "../interaction/useSwipeBack";
import { useRuntimeServices } from "../../runtime";
import { runDocumentAction } from "../../app/documentActions";
import { runLibraryAction } from "../../app/libraryActions";
import type { MobileTab } from "../../application/stores/mobileShellStore";
import type { BoardControllerPort } from "../../kernel/panel/boardPort";
import { getUiRenderer } from "../../kernel/sdk";
import {
  applyKeymap,
  createInputRouter,
  listActions,
} from "../../kernel/action";
import { useKeymapStore } from "../../application/stores/keymapStore";
import { runCommandById } from "../../kernel/command";
import {
  PanelContext,
  type PanelContextValue,
} from "../panels/PanelContext";
import MindMap from "../../components/MindMap";
import type { MapView, NodeView, WorkspaceView } from "../../types";
import { shellActions } from "./shellActions";
import { APP_EVENTS, emitAppEvent, onAppEvent } from "../../kernel/events";
import { MobileDocumentView } from "../mobile/MobileDocumentView";
import { MobileLibraryRow } from "../mobile/MobileLibraryRow";
import { MobileManagedLibraries } from "../mobile/MobileManagedLibraries";
import { MobileHeader } from "../mobile/MobileHeader";
import { MobileTabBar } from "../mobile/MobileTabBar";
import type { MobileDocumentLink } from "../mobile/types";

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

export function MobileShell({
  workspace,
  activeMap,
  selected,
  board,
  onOpenWorkspace,
  onCreateKnowledgeBase,
  onOpenWorkspacePath,
}: {
  workspace: WorkspaceView | null;
  activeMap: MapView | null;
  selected: NodeView | null;
  board: BoardControllerPort;
  onOpenWorkspace?: () => Promise<void> | void;
  onCreateKnowledgeBase?: () => Promise<void> | void;
  onOpenWorkspacePath?: (path: string) => Promise<void> | void;
}) {
  const {
    tab,
    documentId,
    editing,
    hydrate,
    setTab: setStoredTab,
    history,
    reset: resetMobile,
    setEditing,
  } = useMobileShellStore();
  const { dialogs, documentActions, navigation, library, lifecycle } =
    useRuntimeServices();
  const keymap = useKeymapStore((state) => state.document);
  const loadKeymap = useKeymapStore((state) => state.load);
  const [menuDocument, setMenuDocument] =
    useState<MobileDocumentLink | null>(null);
  const [managedLibraries, setManagedLibraries] = useState<
    ManagedLibrarySummary[]
  >([]);
  const map = activeMap ?? workspace?.maps[0] ?? null;
  const swipeBack = useSwipeBack({
    onBack: () => {
      navigation.back();
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
    return lifecycle.onBackground(() => {
      if (useMobileShellStore.getState().editing) {
        emitAppEvent(APP_EVENTS.saveNow);
      }
    });
  }, [lifecycle]);

  useEffect(() => {
    if (tab !== "library") {
      return;
    }
    let cancelled = false;
    void managedLibraryService
      .list()
      .then((libraries) => {
        if (!cancelled) {
          setManagedLibraries(Array.isArray(libraries) ? libraries : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setManagedLibraries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, workspace?.root]);

  useEffect(() => {
    return onAppEvent(APP_EVENTS.openBlockDocument, (documentId) => {
      if (documentId) {
        const current = useMobileShellStore.getState();
        if (current.editing) {
          emitAppEvent(APP_EVENTS.saveNow);
        }
        navigation.openDocument(documentId);
      }
    });
  }, [navigation]);

  if (!workspace || !map) {
    return (
      <div className="mobile-shell mobile-shell-empty">
        <p>请先打开一个知识库。</p>
        <div className="mobile-shell-actions">
          <button type="button" onClick={() => void onOpenWorkspace?.()}>
            打开知识库
          </button>
          <button
            type="button"
            onClick={() => void onCreateKnowledgeBase?.()}
          >
            新建知识库
          </button>
        </div>
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
    navigation.openDocument(id);
  };

  const exportManagedLibrary = async (item: ManagedLibrarySummary) => {
    try {
      await runLibraryAction("library.export", {
        platform: "mobile",
        library,
        source: item.path,
        onExported: (path) => dialogs.alert(`已导出到 ${path}`),
      });
    } catch (error) {
      dialogs.alert(String(error));
    }
  };

  const importManagedLibrary = async () => {
    try {
      await runLibraryAction("library.import", {
        platform: "mobile",
        library,
        onImported: (path) => {
          void onOpenWorkspacePath?.(path);
        },
      });
    } catch (error) {
      dialogs.alert(String(error));
    }
  };

  const openDocumentFromAction = async (document: MobileDocumentLink) => {
    try {
      await runDocumentAction("document.open", {
        platform: "mobile",
        document: {
          id: document.id,
          title: document.title,
          workspaceRoot: workspace.root,
        },
        dialogs,
        documentActions,
      });
    } catch (error) {
      dialogs.alert(String(error));
    }
  };


  const renameDocument = async (document: MobileDocumentLink) => {
    try {
      await runDocumentAction("document.rename", {
        platform: "mobile",
        document: {
          id: document.id,
          title: document.title,
          workspaceRoot: workspace.root,
        },
        dialogs,
        documentActions,
      });
    } catch (error) {
      dialogs.alert(String(error));
    }
  };

  const deleteDocument = async (document: MobileDocumentLink) => {
    try {
      await runDocumentAction("document.delete", {
        platform: "mobile",
        document: {
          id: document.id,
          title: document.title,
          workspaceRoot: workspace.root,
        },
        dialogs,
        documentActions,
        onDeleted: () => {
          if (documentId === document.id) {
            requestSave();
            if (!navigation.back()) {
              resetMobile();
            }
          }
        },
      });
    } catch (error) {
      dialogs.alert(String(error));
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
  const documentMenuActions = listActions().filter(
    (action) => action.category === "document",
  );

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
      <MobileHeader
        tab={tab}
        mapTitle={map.title}
        workspaceTitle={workspace.title}
        canGoBack={history.length > 0}
        onBack={() => navigation.back()}
        onSearch={() => runMobileAction("search.open")}
        onHelp={() => runMobileAction("help.open")}
        onBoard={() => runMobileAction("board.open")}
      />

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
          <div className="mobile-library-view">
            <MobileManagedLibraries
              libraries={managedLibraries}
              workspaceRoot={workspace.root}
              onOpen={(path) => void onOpenWorkspacePath?.(path)}
              onImport={() => void importManagedLibrary()}
              onExport={(item) => void exportManagedLibrary(item)}
            />
            {documents.length > 0 ? (
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
            )}
          </div>
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

      <MobileTabBar
        tab={tab}
        documentId={documentId}
        onSwitchTab={switchTab}
        onSettings={() => runMobileAction("settings.open")}
      />

      {menuDocument && (
        <MobileActionSheet
          title={menuDocument.title}
          onClose={() => setMenuDocument(null)}
          items={documentMenuActions.map((action) => ({
            id: action.id,
            label: action.title,
            tone: action.id === "document.delete" ? "danger" : "default",
            onSelect: () => {
              const document = menuDocument;
              setMenuDocument(null);
              if (action.id === "document.open") {
                void openDocumentFromAction(document);
              } else if (action.id === "document.rename") {
                void renameDocument(document);
              } else if (action.id === "document.delete") {
                void deleteDocument(document);
              }
            },
          }))}
        />
      )}
    </div>
  );
}
