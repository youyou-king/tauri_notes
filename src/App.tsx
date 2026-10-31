import { useCallback, useEffect, useRef, useState } from "react";
import DockWorkspace, {
  type DockWorkspaceHandle,
} from "./components/DockWorkspace";
import { SettingsHost } from "./ui/settings/SettingsHost";
import { PluginOverlays } from "./ui/plugins/PluginOverlays";
import { setSearchHitHandler } from "./app/searchNavigation";
import { useShellProfile } from "./ui/shell/useShellProfile";
import { MobileShell } from "./ui/shell/MobileShell";
import { useBoardController } from "./app/useBoardController";
import { workspaceService } from "./application/workspaceService";
import { useWorkspaceSelectionStore } from "./application/stores/workspaceSelectionStore";
import {
  selectActiveWorkspace,
  useWorkspaceStore,
} from "./application/stores/workspaceStore";
import { usePanelStore } from "./application/stores/panelStore";
import { recordConsoleEvent } from "./application/consoleLogStore";
import {
  ConfirmDialogHost,
  confirmDialog,
} from "./ui/dialog/confirmDialog";
import "./app/navCommands";
import { useAppShell } from "./app/useAppShell";
import { useWorkspaceNavigation } from "./app/useWorkspaceNavigation";
import { usePluginReady } from "./ui/plugins/PluginProvider";
import { useWorkspaceOpen } from "./app/useWorkspaceOpen";
import { checkPluginSdkVersion } from "./app/pluginSdkCheck";
import {
  useNoteDrop,
  usePendingNoteFile,
  useWindowCloseGuard,
  useWindowTitle,
} from "./app/useAppLifecycle";
import { useDocumentEvents } from "./app/useDocumentEvents";
import {
  useAppCommandRunner,
  useAppHotkeys,
} from "./app/useAppCommands";
import { AppToolbar } from "./app/AppToolbar";
import { ensureLibrary } from "./infrastructure/libraryBootstrapper";
import type { BlockId, DocId } from "./domain/ids";
import type { MapView, WorkspaceView } from "./types";
import { writeSession } from "./application/sessionService";
import { APP_EVENTS, onAppEvent } from "./kernel/events";

function App() {
  const pluginReady = usePluginReady();
  const shell = useShellProfile();
  const activeMapId = useWorkspaceSelectionStore(
    (state) => state.activeMapId,
  );
  const selected = useWorkspaceSelectionStore(
    (state) => state.selectedNode,
  );
  const setSelected = useWorkspaceSelectionStore(
    (state) => state.setSelectedNode,
  );
  const select = useWorkspaceSelectionStore((state) => state.select);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const setWorkspace = useWorkspaceStore(
    (state) => state.setActiveWorkspace,
  );
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const setWorkspaces = useWorkspaceStore(
    (state) => state.setWorkspaces,
  );

  const rememberWorkspace = useCallback((view: WorkspaceView) => {
    setWorkspaces((current) => {
      const index = current.findIndex((item) => item.root === view.root);
      if (index < 0) {
        return [...current, view];
      }
      const next = [...current];
      next[index] = view;
      return next;
    });
    setWorkspace(view);
  }, []);
  const [backend, setBackend] = useState("未连接");

  useAppShell();

  useEffect(() => {
    if (!workspace) {
      return;
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ root?: string }>).detail;
      const targetRoot = detail?.root ?? workspace.root;
      void workspaceService
        .open(targetRoot)
        .then((view) => {
          setWorkspaces((current) =>
            current.map((item) =>
              item.root === view.root ? view : item,
            ),
          );
          setWorkspace((current) =>
            current && current.root === view.root
              ? { ...current, maps: view.maps, title: view.title }
              : current,
          );
        })
        .catch((reason) => setError(String(reason)));
    };
    window.addEventListener("tauri-notes:maps-changed", handler);
    return () =>
      window.removeEventListener("tauri-notes:maps-changed", handler);
  }, [workspace?.root]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyPanels = usePanelStore((state) => state.dirtyPanels);
  const setPanelDirty = usePanelStore((state) => state.setPanelDirty);
  const board = useBoardController(workspace?.root ?? null);
  const dockRef = useRef<DockWorkspaceHandle>(null);
  const dirtyRef = useRef(0);
  const sessionReady = useRef(false);

  const appendLog = useCallback((line: string) => {
    recordConsoleEvent("action", line);
  }, []);

  useEffect(() => {
    recordConsoleEvent("system", "应用启动");
  }, []);

  useEffect(() => {
    void checkPluginSdkVersion().then((message) => {
      if (message) {
        setError(message);
      }
    });
  }, []);

  const activeMap: MapView | null =
    workspace?.maps.find((map) => map.id === activeMapId) ?? null;
  const dirtyCount = Object.values(dirtyPanels).filter(Boolean).length;
  dirtyRef.current = dirtyCount;

  const handlePanelDirty = useCallback(
    (panelId: string, dirty: boolean) => {
      setPanelDirty(panelId, dirty);
    },
    [setPanelDirty],
  );

  const handleActiveMapPanel = useCallback(
    (mapId: string, workspaceRoot?: string) => {
      const target =
        workspaces.find((item) => item.root === workspaceRoot) ??
        workspace;
      const map = target?.maps.find((item) => item.id === mapId);
      if (!target || !map) {
        return;
      }
      if (workspace?.root !== target.root) {
        setWorkspace(target);
      }
      select(map.id, map.root);
    },
    [
      select,
      setWorkspace,
      workspace,
      workspaces,
    ],
  );

  async function confirmDiscard(): Promise<boolean> {
    if (dirtyCount === 0) {
      return true;
    }
    return confirmDialog({
      title: "放弃未保存的修改？",
      message: `有 ${dirtyCount} 个面板还有未保存的修改，确定离开吗？`,
      confirmLabel: "放弃修改",
      tone: "danger",
    });
  }

  const {
    selectNode,
    switchMap,
    activateWorkspace,
    unloadWorkspace,
    renameWorkspaceDisplay,
    openSearchHit,
  } = useWorkspaceNavigation({
    workspace,
    workspaces,
    activeMap,
    selected,
    setWorkspace,
    setWorkspaces,
    setSelected,
    select,
    appendLog,
    confirmDiscard,
    setError,
    dockRef,
  });

  useEffect(() => {
    setSearchHitHandler(openSearchHit);
    return () => setSearchHitHandler(null);
  }, [openSearchHit]);

  const {
    backupLibrary,
    createKnowledgeBase,
    openWorkspace,
    openHelp,
    restoreSession,
    openOnlyWorkspace,
  } = useWorkspaceOpen({
    workspace,
    workspaces,
    rememberWorkspace,
    setWorkspace,
    setWorkspaces,
    select,
    renameWorkspaceDisplay,
    setBusy,
    setError,
    setBackend,
    appendLog,
    confirmDiscard,
    dockRef,
  });

  useEffect(() => {
    const handler = () => {
      void openHelp();
    };
    return onAppEvent(APP_EVENTS.helpOpen, handler);
  }, [openHelp]);

  useEffect(() => {
    const openBoard = () => {
      if (!workspace) {
        return;
      }
      board.openBoard();
      dockRef.current?.openBoard();
    };
    return onAppEvent(APP_EVENTS.boardOpen, openBoard);
  }, [board.openBoard, workspace]);

  useDocumentEvents({
    workspaceRoot: workspace?.root ?? null,
    setWorkspace,
    appendLog,
    dockRef,
  });

  const runNavCommand = useAppCommandRunner({
    busy,
    workspaceRoot: workspace?.root ?? null,
    dockRef,
    setBackend,
    setError,
    createKnowledgeBase,
    openWorkspace,
    openHelp,
    backupLibrary,
  });

  useWindowTitle(dirtyCount);

  useEffect(() => {
    window.__TAURI_WORKSPACE_ROOT__ = workspace?.root ?? "";
    const root = workspace?.root;
    if (!root) {
      return;
    }
    if (/\.note$/i.test(root)) {
      return;
    }
    void ensureLibrary(root)
      .then((status) => {
        appendLog(
          `正式库就绪：${status.documents} 文档 / ${status.blocks} 块 / ${status.references} 引用`,
        );
      })
      .catch((error) => {
        appendLog(`正式库初始化失败：${String(error)}`);
      });
  }, [appendLog, workspace?.root]);

  useWindowCloseGuard(dirtyRef);

  useAppHotkeys({
    workspaceRoot: workspace?.root ?? null,
    board,
    dockRef,
    setError,
  });

  usePendingNoteFile({
    sessionReady,
    openOnlyWorkspace,
    restoreSession,
    resetLayout: () => dockRef.current?.resetLayout(),
    setError,
  });

  useEffect(() => {
    if (!sessionReady.current) {
      return;
    }
    writeSession(
      workspaces.map((item) => item.root),
      workspace?.root ?? null,
      {
        activeMapId,
        selectedNodeId: selected?.id ?? null,
      },
    );
  }, [activeMapId, selected?.id, workspaces, workspace?.root]);

  useNoteDrop(openOnlyWorkspace);

  return (
    <div
      className="app"
      data-shell={shell.kind}
      data-shell-layout={shell.layout}
    >
      <AppToolbar
        backend={backend}
        busy={busy}
        hasWorkspace={Boolean(workspace)}
        runCommand={runNavCommand}
      />

      <div className="body">
        <main className="workspace">
          <div className="workspace-header">
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="dock-fill">
            {pluginReady && shell.kind === "mobile" ? (
              <MobileShell
                workspace={workspace}
                activeMap={activeMap}
                selected={selected}
                board={board}
              />
            ) : pluginReady ? (
            <DockWorkspace
              ref={dockRef}
              workspace={workspace}
              workspaces={workspaces}
              activeMap={activeMap}
              selected={selected}
              onActiveNode={(node) => setSelected(node)}
              onActiveMap={handleActiveMapPanel}
              onPanelDirty={handlePanelDirty}
              onSelectNode={selectNode}
              onSwitchMap={switchMap}
              onActivateWorkspace={activateWorkspace}
              onUnloadWorkspace={unloadWorkspace}
              onRenameWorkspace={renameWorkspaceDisplay}
              onPinBlock={async (input) => {
                await board.pinBlock({
                  blockId: input.blockId as BlockId,
                  docId: input.docId as DocId,
                  docTitle: input.docTitle,
                  text: input.text,
                });
                dockRef.current?.openBoard();
              }}
              board={board}
            />
            ) : (
              <div className="dock-workspace-loading">正在加载插件…</div>
            )}
          </div>
        </main>
      </div>

      <PluginOverlays />
      <SettingsHost />
      <ConfirmDialogHost />
    </div>
  );
}

export default App;
