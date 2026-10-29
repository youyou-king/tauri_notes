import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import DockWorkspace, {
  type DockWorkspaceHandle,
} from "./components/DockWorkspace";
import SearchPalette from "./components/SearchPalette";
import { useBoardController } from "./ui/board/useBoardController";
import { workspaceService } from "./application/workspaceService";
import { useWorkspaceSelectionStore } from "./application/stores/workspaceSelectionStore";
import { useWorkspaceStore } from "./application/stores/workspaceStore";
import { usePanelStore } from "./application/stores/panelStore";
import { recordConsoleEvent } from "./application/consoleLogStore";
import {
  ConfirmDialogHost,
  confirmDialog,
} from "./ui/dialog/confirmDialog";
import {
  executeCommand,
  findCommandForEvent,
  getCommand,
} from "./ui/commands/registry";
import "./app/commands";
import "./app/navCommands";
import { useWorkspaceNavigation } from "./app/useWorkspaceNavigation";
import { useWorkspaceOpen } from "./app/useWorkspaceOpen";
import { useDocumentEvents } from "./app/useDocumentEvents";
import { AppToolbar, type NavbarMenu } from "./app/AppToolbar";
import { ensureLibrary } from "./infrastructure/libraryBootstrapper";
import type { BlockId, DocId } from "./domain/ids";
import type { MapView, WorkspaceView } from "./types";
import { writeSession } from "./application/sessionService";

function App() {
  const activeMapId = useWorkspaceSelectionStore(
    (state) => state.activeMapId,
  );
  const selected = useWorkspaceSelectionStore(
    (state) => state.selectedNode,
  );
  const setActiveMapId = useWorkspaceSelectionStore(
    (state) => state.setActiveMapId,
  );
  const setSelected = useWorkspaceSelectionStore(
    (state) => state.setSelectedNode,
  );
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
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
  const [navbarMenu, setNavbarMenu] = useState<NavbarMenu>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handler);
    return () => window.removeEventListener("contextmenu", handler);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        !target.closest(".toolbar-menu") &&
        !target.closest(".app-dialog-backdrop")
      ) {
        setNavbarMenu(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

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
  const [searchOpen, setSearchOpen] = useState(false);
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
    setActiveMapId,
    setSelected,
    appendLog,
    confirmDiscard,
    setError,
    setSearchOpen,
    dockRef,
  });

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
    setActiveMapId,
    setSelected,
    renameWorkspaceDisplay,
    setBusy,
    setError,
    setBackend,
    appendLog,
    confirmDiscard,
    dockRef,
  });

  useDocumentEvents({
    workspaceRoot: workspace?.root ?? null,
    setWorkspace,
    appendLog,
    dockRef,
  });

  function runNavCommand(id: string): void {
    const command = getCommand(id);
    if (!command) {
      return;
    }
    recordConsoleEvent("command", command.label, id);
    executeCommand(command, {
      busy,
      hasWorkspace: Boolean(workspace),
      createKnowledge: () => void createKnowledgeBase(),
      openKnowledge: () => void openWorkspace(),
      openHelp: () => void openHelp(),
      backup: () => void backupLibrary(),
      setAssociation: () => {
        void workspaceService
          .registerNoteAssociation()
          .then(() => setBackend("已设置 .note 文件关联"))
          .catch((reason) => setError(String(reason)));
      },
      clearAssociation: () => {
        void workspaceService
          .unregisterNoteAssociation()
          .then(() => setBackend("已清除 .note 文件关联"))
          .catch((reason) => setError(String(reason)));
      },
      toggleOutline: () => dockRef.current?.togglePanel("outline"),
      toggleConsole: () => dockRef.current?.togglePanel("console"),
      resetLayout: () => dockRef.current?.resetLayout(),
    });
  }

  useEffect(() => {
    getCurrentWindow()
      .setTitle(dirtyCount > 0 ? "• Tauri Notes" : "Tauri Notes")
      .catch(() => {});
  }, [dirtyCount]);

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

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    getCurrentWindow()
      .onCloseRequested((event) => {
        // 没有脏面板时走原生关闭，避免任何权限/WebView2 事件卡住。
        if (dirtyRef.current === 0) {
          return;
        }
        event.preventDefault();
        void confirmDialog({
          title: "关闭 Tauri Notes？",
          message: "关闭会丢失未保存的修改，仍要关闭吗？",
          confirmLabel: "关闭",
          tone: "danger",
        }).then((confirmed) => {
          if (confirmed) {
            void getCurrentWindow().destroy();
          }
        });
      })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const context = {
      hasWorkspace: Boolean(workspace),
      openBoard: () => {
        board.openBoard();
        dockRef.current?.openBoard();
      },
      openSearch: () => setSearchOpen(true),
    };
    function onKeyDown(event: KeyboardEvent) {
      const command = findCommandForEvent(event, context);
      if (!command) {
        return;
      }
      event.preventDefault();
      recordConsoleEvent("command", command.label, `快捷键 ${command.id}`);
      executeCommand(command, context);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board.openBoard, workspace]);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let handling = false;

    const tick = async () => {
      if (cancelled || handling) {
        return;
      }
      handling = true;
      try {
        const path = await workspaceService.takePendingNoteFile();
        if (cancelled) {
          return;
        }
        if (path) {
          initialized = true;
          sessionReady.current = true;
          await openOnlyWorkspace(path);
          return;
        }
        if (!initialized) {
          initialized = true;
          const restored = await restoreSession();
          sessionReady.current = true;
          if (!restored) {
            dockRef.current?.resetLayout();
          }
        }
      } catch (reason) {
        setError(String(reason));
      } finally {
        handling = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 800);
    const unlisten = listen<string>("open-note-file", () => {
      void tick();
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void unlisten.then((stop) => stop());
    };
    // 直接启动恢复上次会话；带 .note 参数时只打开该文件。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionReady.current) {
      return;
    }
    writeSession(
      workspaces.map((item) => item.root),
      workspace?.root ?? null,
    );
  }, [workspaces, workspace?.root]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if ([...(event.dataTransfer?.types ?? [])].includes("Files")) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      const file = [...(event.dataTransfer?.files ?? [])].find((item) =>
        /\.note$/i.test(item.name),
      );
      if (!file) {
        return;
      }
      event.preventDefault();
      const path = (file as File & { path?: string }).path;
      if (path) {
        void openOnlyWorkspace(path);
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <AppToolbar
        backend={backend}
        busy={busy}
        hasWorkspace={Boolean(workspace)}
        menu={navbarMenu}
        setMenu={setNavbarMenu}
        runCommand={runNavCommand}
      />

      <div className="body">
        <main className="workspace">
          <div className="workspace-header">
            {error && <div className="error-banner">{error}</div>}
          </div>
          <div className="dock-fill">
            <DockWorkspace
              ref={dockRef}
              workspace={workspace}
              workspaces={workspaces}
              activeMap={activeMap}
              selected={selected}
              onActiveNode={(node) => setSelected(node)}
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
          </div>
        </main>
      </div>

      {searchOpen && workspace && (
        <SearchPalette
          workspace={workspace}
          onClose={() => setSearchOpen(false)}
          onOpenHit={openSearchHit}
        />
      )}
      <ConfirmDialogHost />
    </div>
  );
}

export default App;
