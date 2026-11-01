import { useCallback, useEffect, useRef, useState } from "react";
import type { DockWorkspaceHandle } from "./components/DockWorkspace";
import { SettingsHost } from "./ui/settings/SettingsHost";
import { PluginOverlays } from "./ui/plugins/PluginOverlays";
import { setSearchHitHandler } from "./app/searchNavigation";
import { useRuntime } from "./runtime";
import { useBoardController } from "./app/useBoardController";
import { useWorkspaceSelectionStore } from "./application/stores/workspaceSelectionStore";
import {
  selectActiveWorkspace,
  useWorkspaceStore,
} from "./application/stores/workspaceStore";
import { usePanelStore } from "./application/stores/panelStore";
import { recordConsoleEvent } from "./application/consoleLogStore";
import { ConfirmDialogHost } from "./ui/dialog/confirmDialog";
import "./app/navCommands";
import "./app/actions";
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
import type { BlockId, DocId } from "./domain/ids";
import type { MapView, WorkspaceView } from "./types";
import { APP_EVENTS, onAppEvent } from "./kernel/events";
import { requestClose } from "./app/requestClose";
import type { OpenRequest } from "./app/openRequest";
import {
  useLibraryBootstrap,
  useMapsChangedRefresh,
  useSessionPersistence,
} from "./app/useAppWorkspaceEffects";

function App() {
  const pluginReady = usePluginReady();
  const runtime = useRuntime();
  const Shell = runtime.Shell;
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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
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

  useMapsChangedRefresh(workspace, setWorkspaces, setWorkspace, setError);

  useLibraryBootstrap(workspace?.root ?? null, appendLog);

  useSessionPersistence({
    sessionReady,
    workspaces,
    workspaceRoot: workspace?.root ?? null,
    activeMapId,
    selectedNodeId: selected?.id ?? null,
    activePanelId,
  });

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
    return requestClose({ kind: "workspace", dirtyCount });
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

  const openRequestedWorkspace = useCallback(
    (request: OpenRequest) => openOnlyWorkspace(request.path),
    [openOnlyWorkspace],
  );

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
    confirmDiscard,
  });

  useWindowTitle(dirtyCount);

  useWindowCloseGuard(dirtyRef);

  useAppHotkeys({
    workspaceRoot: workspace?.root ?? null,
    board,
    dockRef,
    setError,
  });

  usePendingNoteFile({
    sessionReady,
    openOnlyWorkspace: openRequestedWorkspace,
    restoreSession,
    resetLayout: () => dockRef.current?.resetLayout(),
    setError,
  });

  useNoteDrop(openRequestedWorkspace);

  return (
    <div
      className="app"
      data-shell={runtime.shellKind}
      data-shell-layout={runtime.layout}
    >
      <Shell
        pluginReady={pluginReady}
        backend={backend}
        busy={busy}
        error={error}
        runCommand={runNavCommand}
        dockRef={dockRef}
        workspace={workspace}
        workspaces={workspaces}
        activeMap={activeMap}
        selected={selected}
        onActiveNode={(node) => setSelected(node)}
        onActiveMap={handleActiveMapPanel}
        onPanelDirty={handlePanelDirty}
        onPanelActive={setActivePanelId}
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

      <PluginOverlays />
      <SettingsHost />
      <ConfirmDialogHost />
    </div>
  );
}

export default App;
