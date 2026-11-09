import { useEffect, useState } from "react";
import {
  useMobileShellStore,
  type MobileDropPlacement,
  type MobileView,
  type MobileViewKind,
} from "../../application/stores/mobileShellStore";
import {
  resolveDropPlacement,
} from "../../application/stores/mobileLayout";
import { useSwipeBack } from "../interaction/useSwipeBack";
import { useRuntimeServices } from "../../runtime";
import { runDocumentAction } from "../../app/documentActions";
import { documentService } from "../../application/documentService";
import type { BoardControllerPort } from "../../kernel/panel/boardPort";
import { getUiRenderer } from "../../kernel/sdk";
import {
  applyKeymap,
  createInputRouter,
  listActions,
} from "../../kernel/action";
import { useKeymapStore } from "../../application/stores/keymapStore";
import { runCommandById } from "../../kernel/command";
import { CORE_TOOLBAR_ITEMS } from "../../app/coreToolbar";
import { workspaceService } from "../../application/workspaceService";
import type { PanelContextValue } from "../panels/PanelContext";
import MindMap from "../../components/MindMap";
import type { MapView, NodeView, WorkspaceView } from "../../types";
import { shellActions } from "./shellActions";
import { Button } from "../design-system/Button";
import { message } from "../design-system/Message";
import { APP_EVENTS, emitAppEvent, onAppEvent } from "../../kernel/events";
import { MobileDocumentPane } from "../mobile/MobileDocumentPane";
import { MobileDocumentActionSheet } from "../mobile/MobileDocumentActionSheet";
import { MobileTopBar } from "../mobile/MobileTopBar";
import { MobileDock } from "../mobile/MobileDock";
import { MobileNavDrawer } from "../mobile/MobileNavDrawer";
import { MobileOutlineView } from "../mobile/MobileOutlineView";
import { MobileLibraryManager } from "../mobile/MobileLibraryManager";
import { useManagedLibraries } from "../mobile/useManagedLibraries";
import { MobileWorkspace } from "../mobile/MobileWorkspace";
import { MobileDockDropOverlay } from "../mobile/MobileDockDropOverlay";
import type { MobileDragPoint } from "../mobile/MobileDock";
import type { MobileDocumentLink } from "../mobile/types";

function viewLabel(view: MobileView, mapTitle: string): string {
  if (view.kind === "map") {
    return mapTitle;
  }
  if (view.kind === "outline") {
    return "大纲";
  }
  return "文档";
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
    views,
    focused,
    ratios,
    axis,
    editing,
    hydrate,
    selectView,
    dropView,
    closeSplit,
    setSplitRatio,
    focusPane,
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [libraryManagerOpen, setLibraryManagerOpen] = useState(false);
  const [dockDrag, setDockDrag] = useState<{
    kind: MobileViewKind;
    point: MobileDragPoint;
    placement: MobileDropPlacement;
  } | null>(null);
  const {
    libraries: managedLibraries,
    deleteLibrary,
    exportLibrary,
    importLibrary,
  } = useManagedLibraries({
    open: libraryManagerOpen,
    workspaceId: workspace?.id ?? null,
    library,
    dialogs,
    onOpenPath: (path) => void onOpenWorkspacePath?.(path),
  });
  const [documentTitle, setDocumentTitle] = useState("文档");
  const map = activeMap ?? workspace?.maps[0] ?? null;
  const primaryView = views[0];
  const secondaryView = views[1];
  const focusedView = views[focused] ?? primaryView;
  const documentViews = views.filter(
    (view): view is MobileView & { documentId: string } =>
      Boolean(view && view.kind === "document" && view.documentId),
  );
  const activeDocumentId =
    focusedView.kind === "document"
      ? focusedView.documentId
      : (documentViews[0]?.documentId ?? null);
  const lastDocumentId =
    [...history]
      .reverse()
      .find(
        (view): view is MobileView & { documentId: string } =>
          view.kind === "document" && Boolean(view.documentId),
      )?.documentId ?? null;
  const knownDocumentId = activeDocumentId ?? lastDocumentId;

  const goBack = () => {
    navigation.back();
  };

  const swipeBack = useSwipeBack({
    onBack: goBack,
    edgeOnly: editing,
  });

  useEffect(() => {
    void loadKeymap();
    return onAppEvent(APP_EVENTS.keymapChanged, () => {
      void loadKeymap();
    });
  }, [loadKeymap]);

  useEffect(() => {
    hydrate(workspace?.id ?? null);
  }, [hydrate, workspace?.id]);

  useEffect(() => {
    return lifecycle.onBackground(() => {
      if (useMobileShellStore.getState().editing) {
        emitAppEvent(APP_EVENTS.saveNow);
      }
    });
  }, [lifecycle]);

  useEffect(() => {
    if (!activeDocumentId || !workspace) {
      setDocumentTitle("文档");
      return;
    }
    let cancelled = false;
    const load = () => {
      void documentService
        .getTitle(workspace.id, activeDocumentId)
        .then((title) => {
          if (!cancelled) {
            setDocumentTitle(title || "文档");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDocumentTitle("文档");
          }
        });
    };
    load();
    const unsubscribers = [
      onAppEvent(APP_EVENTS.documentRenamed, load),
      onAppEvent(APP_EVENTS.documentChanged, load),
    ];
    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeDocumentId, workspace?.id]);

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

  const switchView = (kind: MobileView["kind"]) => {
    if (focusedView.kind !== kind) {
      requestSave();
    }
    selectView(kind, kind === "document" ? knownDocumentId : null);
    setDrawerOpen(false);
  };

  const updateDockDrag = (kind: MobileViewKind, point: MobileDragPoint) => {
    setDockDrag({
      kind,
      point,
      placement: resolveDropPlacement(point, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    });
  };

  const dropDockView = (kind: MobileViewKind, point: MobileDragPoint) => {
    requestSave();
    dropView(
      kind,
      resolveDropPlacement(point, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
      kind === "document" ? knownDocumentId : null,
    );
    setDockDrag(null);
  };

  const openDocument = (id: string) => {
    requestSave();
    navigation.openDocument(id);
    setDrawerOpen(false);
  };

  const backupWorkspace = async () => {
    try {
      const path = await workspaceService.backup(
        workspace.id,
        workspace.root,
        /\.note$/i.test(workspace.root),
      );
      message.success(`备份完成：${path}`);
    } catch (error) {
      message.error(String(error));
    }
  };

  const runKnowledgeCommand = (id: string | undefined) => {
    setDrawerOpen(false);
    if (id === "knowledge.create") {
      void onCreateKnowledgeBase?.();
    } else if (id === "knowledge.open") {
      void onOpenWorkspace?.();
    } else if (id === "knowledge.backup") {
      void backupWorkspace();
    }
  };
  const knowledgeItems = CORE_TOOLBAR_ITEMS.filter(
    (item) => item.menu === "knowledge",
  );

  const openDocumentFromAction = async (document: MobileDocumentLink) => {
    try {
      await runDocumentAction("document.open", {
        platform: "mobile",
        document: {
          id: document.id,
          title: document.title,
          workspaceId: workspace.id,
        },
        dialogs,
        documentActions,
      });
    } catch (error) {
      message.error(String(error));
    }
  };

  const renameDocument = async (document: MobileDocumentLink) => {
    try {
      await runDocumentAction("document.rename", {
        platform: "mobile",
        document: {
          id: document.id,
          title: document.title,
          workspaceId: workspace.id,
        },
        dialogs,
        documentActions,
      });
    } catch (error) {
      message.error(String(error));
    }
  };

  const deleteDocument = async (document: MobileDocumentLink) => {
    try {
      await runDocumentAction("document.delete", {
        platform: "mobile",
        document: {
          id: document.id,
          title: document.title,
          workspaceId: workspace.id,
        },
        dialogs,
        documentActions,
        onDeleted: () => {
          if (activeDocumentId === document.id) {
            requestSave();
            if (!navigation.back()) {
              resetMobile();
            }
          }
        },
      });
    } catch (error) {
      message.error(String(error));
    }
  };

  const handleDocumentMenuAction = (
    actionId: string,
    document: MobileDocumentLink,
  ) => {
    setMenuDocument(null);
    if (actionId === "document.open") {
      void openDocumentFromAction(document);
    } else if (actionId === "document.rename") {
      void renameDocument(document);
    } else if (actionId === "document.delete") {
      void deleteDocument(document);
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
  const runDrawerAction = (surface: string) => {
    setDrawerOpen(false);
    runMobileAction(surface);
  };

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
    lastActiveDocId: activeDocumentId,
  };

  const renderPane = (view: MobileView) => {
    if (view.kind === "map") {
      return (
        <MindMap
          libraryId={workspace.id}
          mapId={map.id}
          mapTitle={map.title}
          selectedId={selected?.id ?? null}
          onOpenDocument={openDocument}
        />
      );
    }
    if (view.kind === "outline") {
      return (
        <MobileOutlineView
          libraryId={workspace.id}
          mapId={map.id}
          mapTitle={map.title}
          activeDocumentId={knownDocumentId}
          onOpenDocument={openDocument}
          onDocumentMenu={(documentId, title) =>
            setMenuDocument({ id: documentId, title })
          }
        />
      );
    }
    return view.documentId ? (
      <MobileDocumentPane
        workspaceRoot={workspace.root}
        libraryId={workspace.id}
        documentId={view.documentId}
        editing={editing}
        panelContext={panelContext}
        DocumentView={DocumentView}
        swipeHandlers={swipeBack}
      />
    ) : (
      <div className="mobile-shell-empty">
        <p>从导图或大纲打开一篇文档。</p>
      </div>
    );
  };

  const title =
    focusedView.kind === "document"
      ? documentTitle
      : viewLabel(focusedView, map.title);
  const subtitle = secondaryView
    ? `${workspace.title} · 分屏`
    : focusedView.kind === "map" && map.title === workspace.title
      ? undefined
      : workspace.title;
  const canGoBack = Boolean(secondaryView || history.length > 0);
  const presentKinds = views
    .filter((view): view is MobileView => Boolean(view))
    .map((view) => view.kind);

  return (
    <div className="mobile-shell">
      <MobileTopBar
        title={title}
        subtitle={subtitle}
        canGoBack={canGoBack}
        onBack={goBack}
        onMenu={() => setDrawerOpen(true)}
        actions={
          focusedView.kind === "document" ? (
            editing ? (
              <>
                <Button onClick={() => emitAppEvent(APP_EVENTS.saveNow)}>
                  保存
                </Button>
                <Button
                  onClick={() => {
                    emitAppEvent(APP_EVENTS.saveNow);
                    setEditing(false);
                  }}
                >
                  完成
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>编辑</Button>
            )
          ) : undefined
        }
      />

      <div className="mobile-shell-content">
        <MobileWorkspace
          views={views}
          focused={focused}
          ratios={ratios}
          axis={axis}
          onFocus={focusPane}
          onRatio={setSplitRatio}
          onCloseSplit={closeSplit}
          renderView={renderPane}
          labelFor={(view) => viewLabel(view, map.title)}
        />
        <MobileDockDropOverlay
          active={Boolean(dockDrag)}
          label={
            dockDrag
              ? viewLabel(
                  { kind: dockDrag.kind, documentId: null },
                  map.title,
                )
              : ""
          }
          point={dockDrag?.point ?? null}
          placement={dockDrag?.placement ?? null}
        />
      </div>

      <MobileDock
        view={focusedView.kind}
        hasDocument={Boolean(knownDocumentId)}
        presentKinds={presentKinds}
        onSelect={switchView}
        onDragMove={updateDockDrag}
        onDrop={dropDockView}
        onDragCancel={() => setDockDrag(null)}
      />

      <MobileNavDrawer
        open={drawerOpen}
        workspaceTitle={workspace.title}
        knowledgeItems={knowledgeItems}
        onKnowledgeCommand={runKnowledgeCommand}
        onManageLibraries={() => {
          setDrawerOpen(false);
          setLibraryManagerOpen(true);
        }}
        onClose={() => setDrawerOpen(false)}
        onHelp={() => runDrawerAction("help.open")}
        onSettings={() => runDrawerAction("settings.open")}
      />

      {libraryManagerOpen && (
        <MobileLibraryManager
          libraries={managedLibraries}
          workspaceId={workspace.id}
          onOpen={(path) => void onOpenWorkspacePath?.(path)}
          onImport={() => void importLibrary()}
          onExport={(item) => void exportLibrary(item)}
          onDelete={(item) => void deleteLibrary(item)}
          onClose={() => setLibraryManagerOpen(false)}
        />
      )}

      {menuDocument && (
        <MobileDocumentActionSheet
          document={menuDocument}
          actions={documentMenuActions}
          onClose={() => setMenuDocument(null)}
          onAction={handleDocumentMenuAction}
        />
      )}
    </div>
  );
}