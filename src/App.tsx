import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { appDataDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import DockWorkspace, {
  type DockWorkspaceHandle,
} from "./components/DockWorkspace";
import SearchPalette from "./components/SearchPalette";
import { useBoardController } from "./ui/board/useBoardController";
import { workspaceService, type DatabaseTreeNode } from "./application/workspaceService";
import { useWorkspaceSelectionStore } from "./application/stores/workspaceSelectionStore";
import { useWorkspaceStore } from "./application/stores/workspaceStore";
import { usePanelStore } from "./application/stores/panelStore";
import { ThemeMenu } from "./ui/theme/ThemeMenu";
import {
  executeCommand,
  findCommandForEvent,
  getCommand,
} from "./ui/commands/registry";
import "./app/commands";
import "./app/navCommands";
import { ensureLibrary } from "./infrastructure/libraryBootstrapper";
import type { BlockId, DocId } from "./domain/ids";
import type {
  MapView,
  NodeView,
  SearchHit,
  WorkspaceView,
} from "./types";

const SESSION_KEY = "tauri-notes.session.v1";

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

function collectNodeIds(node: NodeView, ids: Set<string>) {
  ids.add(node.id);
  node.children.forEach((child) => collectNodeIds(child, ids));
}

function mergeDatabaseDocuments(
  view: WorkspaceView,
  documents: Array<{ id: string; title: string }>,
): WorkspaceView {
  return {
    ...view,
    maps: view.maps.map((map) => {
      const ids = new Set<string>();
      collectNodeIds(map.root, ids);
      const extras = documents
        .filter((document) => document.id.startsWith(`${map.id}/`))
        .map((document) => ({
          nodeId: document.id.slice(map.id.length + 1),
          title: document.title,
        }))
        .filter((entry) => entry.nodeId && !ids.has(entry.nodeId))
        .map((entry) => ({
          id: entry.nodeId,
          title: entry.title,
          hasDocument: true,
          children: [],
        }));
      if (extras.length === 0) {
        return map;
      }
      return {
        ...map,
        root: {
          ...map.root,
          children: [...map.root.children, ...extras],
        },
      };
    }),
  };
}

function buildDatabaseTree(
  view: WorkspaceView,
  rows: DatabaseTreeNode[],
): WorkspaceView {
  return {
    ...view,
    maps: view.maps.map((map) => {
      const entries = rows.filter((row) => row.mapId === map.id);
      if (entries.length === 0) {
        return map;
      }
      const byParent = new Map<string | null, DatabaseTreeNode[]>();
      entries.forEach((entry) => {
        const parent = entry.parentId ?? null;
        byParent.set(parent, [...(byParent.get(parent) ?? []), entry]);
      });
      const visited = new Set<string>();
      const toNode = (entry: DatabaseTreeNode): NodeView => {
        visited.add(entry.documentId);
        const children = (byParent.get(entry.documentId) ?? [])
          .filter((child) => !visited.has(child.documentId))
          .map(toNode);
        return {
          id: entry.documentId.slice(map.id.length + 1),
          title: entry.title,
          hasDocument: true,
          children,
        };
      };
      const roots = byParent.get(null) ?? [];
      const candidates =
        roots.length > 0
          ? roots
          : entries.filter(
              (entry) =>
                !entry.parentId ||
                !entries.some((parent) => parent.documentId === entry.parentId),
            );
      if (candidates.length === 0) {
        return map;
      }
      const root = toNode(candidates[0]);
      if (candidates.length > 1) {
        root.children.push(...candidates.slice(1).map(toNode));
      }
      return { ...map, root };
    }),
  };
}

async function defaultNotePath(): Promise<string> {
  const lastDirectory = window.localStorage.getItem(
    "tauri-notes.last-note-directory",
  );
  if (lastDirectory) {
    return join(lastDirectory, "未命名.note");
  }
  return join(await appDataDir(), "knowledge", "未命名.note");
}

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
  const [navbarMenu, setNavbarMenu] = useState<
    "knowledge" | "view" | "theme" | null
  >(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handler);
    return () => window.removeEventListener("contextmenu", handler);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".toolbar-menu")) {
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
  const [logs, setLogs] = useState<string[]>(["Tauri Notes 已启动"]);
  const board = useBoardController(workspace?.root ?? null);
  const dockRef = useRef<DockWorkspaceHandle>(null);
  const dirtyRef = useRef(0);
  const autoOpened = useRef(false);
  const sessionReady = useRef(false);

  const appendLog = useCallback((line: string) => {
    setLogs((current) => [...current.slice(-99), line]);
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

  function confirmDiscard(): boolean {
    if (dirtyCount === 0) {
      return true;
    }
    return window.confirm(
      `有 ${dirtyCount} 个面板还有未保存的修改，确定离开吗？`,
    );
  }

  function runNavCommand(id: string): void {
    const command = getCommand(id);
    if (!command) {
      return;
    }
    executeCommand(command, {
      busy,
      hasWorkspace: Boolean(workspace),
      createKnowledge: () => void createKnowledgeBase(),
      openKnowledge: () => void openWorkspace(),
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
    const handler = (event: Event) => {
      const documentId = (event as CustomEvent<string>).detail;
      if (documentId) {
        dockRef.current?.openBlockDocument(documentId);
      }
    };
    window.addEventListener("tauri-notes:open-block-document", handler);
    return () =>
      window.removeEventListener("tauri-notes:open-block-document", handler);
  }, []);

  useEffect(() => {
    const root = workspace?.root;
    if (!root) {
      return;
    }
    const handler = () => {
      void (async () => {
        try {
          const view = await workspaceService.open(root);
          const documents = await workspaceService.listDocuments(root);
          const treeRows = await workspaceService.loadDocumentTree(root);
          setWorkspace(
            treeRows.length > 0
              ? buildDatabaseTree(view, treeRows)
              : mergeDatabaseDocuments(view, documents),
          );
        } catch (error) {
          appendLog(`刷新文档树失败：${String(error)}`);
        }
      })();
    };
    window.addEventListener("tauri-notes:document-changed", handler);
    return () =>
      window.removeEventListener("tauri-notes:document-changed", handler);
  }, [appendLog, workspace?.root]);

  useEffect(() => {
    const handler = (event: Event) => {
      const docId = (event as CustomEvent<string>).detail;
      const separator = docId?.indexOf("/") ?? -1;
      if (separator > 0) {
        dockRef.current?.openDocument(
          docId.slice(0, separator),
          docId.slice(separator + 1),
        );
      }
    };
    window.addEventListener("tauri-notes:open-source", handler);
    return () =>
      window.removeEventListener("tauri-notes:open-source", handler);
  }, []);

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
        if (!window.confirm("关闭会丢失未保存的修改，仍要关闭吗？")) {
          return;
        }
        void getCurrentWindow().destroy();
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
      executeCommand(command, context);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board.openBoard, workspace]);

  async function backupLibrary() {
    if (!workspace) {
      return;
    }
    setBusy(true);
    try {
      const note = /\.note$/i.test(workspace.root);
      const path = await workspaceService.backup(workspace.root, note);
      setBackend(`备份完成：${path}`);
      appendLog(`数据库备份：${path}`);
    } catch (error) {
      setBackend(`备份失败：${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function openWorkspacePath(picked: string) {
    if (!confirmDiscard()) {
      return;
    }
    setBusy(true);
    setError(null);
    const isNote = /\.note$/i.test(picked);
    try {
      const view = await workspaceService.open(picked);
      const map = view.maps[0] ?? null;
      const root = map?.root ?? null;
      if (!isNote && root) {
        await ensureLibrary(picked);
      }
      if (isNote) {
        rememberWorkspace(view);
      } else {
        const databaseDocuments =
          await workspaceService.listDocuments(picked);
        const treeRows = await workspaceService.loadDocumentTree(picked);
        rememberWorkspace(
          treeRows.length > 0
            ? buildDatabaseTree(view, treeRows)
            : mergeDatabaseDocuments(view, databaseDocuments),
        );
      }
      const storedTitle = window.localStorage.getItem(
        `tauri-notes.workspace-title:${view.root}`,
      );
      if (storedTitle) {
        renameWorkspaceDisplay(view.root, storedTitle);
      }
      setActiveMapId(map?.id ?? null);
      setSelected(root);
      setBackend(`已打开：${view.title}（${view.maps.length} 张导图）`);
      appendLog(`打开知识库：${view.title}`);
      if (map && isNote) {
        dockRef.current?.openMap(map.id, view.root);
      } else if (map && root) {
        dockRef.current?.openDocument(map.id, root.id, root.title, view.root);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createKnowledgeBase() {
    setError(null);
    let pickedPath: string | null = null;
    try {
      const picked = await save({
        title: "新建知识库",
        defaultPath: await defaultNotePath(),
        filters: [{ name: "Notes 知识库", extensions: ["note"] }],
      });
      if (!picked || Array.isArray(picked)) {
        return;
      }
      pickedPath = picked;
      window.localStorage.removeItem(
        `tauri-notes.workspace-title:${picked}`,
      );
      const replacing = workspaces.some((item) => item.root === picked);
      setWorkspaces((current) =>
        current.filter((item) => item.root !== picked),
      );
      if (replacing) {
        dockRef.current?.resetLayout();
      } else {
        dockRef.current?.closeWorkspacePanels(picked);
      }
      const view = await workspaceService.createNoteFile(
        picked,
        picked.split(/[\\/]/).pop()?.replace(/\.note$/i, "") ?? "知识库",
      );
      const directory = picked.replace(/[\\/][^\\/]+$/, "");
      window.localStorage.setItem(
        "tauri-notes.last-note-directory",
        directory,
      );
      await openWorkspacePath(view.root);
    } catch (error) {
      window.localStorage.removeItem("tauri-notes.last-note-directory");
      const raw = String(error);
      const blocked =
        /拒绝访问|权限|access denied|os error 5|code: 14/i.test(raw);
      setError(
        pickedPath && blocked
          ? `无法写入 ${pickedPath}。当前应用进程没有该目录的写入权限。\n${raw}`
          : raw,
      );
    }
  }

  async function openWorkspace() {
    if (!confirmDiscard()) {
      return;
    }
    setError(null);
    try {
      const picked = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "Notes 知识库", extensions: ["note"] }],
        title: "打开 .note 知识库",
      });
      if (!picked || Array.isArray(picked)) {
        return;
      }
      await openWorkspacePath(picked);
    } catch (err) {
      setError(String(err));
    }
  }

  function withStoredTitle(view: WorkspaceView): WorkspaceView {
    const stored = window.localStorage.getItem(
      `tauri-notes.workspace-title:${view.root}`,
    );
    return stored ? { ...view, title: stored } : view;
  }

  async function restoreSession(): Promise<boolean> {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return false;
    }
    let roots: string[] = [];
    let activeRoot: string | null = null;
    try {
      const parsed = JSON.parse(raw) as {
        roots?: string[];
        active?: string | null;
      };
      roots = Array.isArray(parsed.roots) ? parsed.roots : [];
      activeRoot = parsed.active ?? null;
    } catch {
      return false;
    }
    const views: WorkspaceView[] = [];
    for (const root of roots) {
      try {
        const view = await workspaceService.open(root);
        views.push(withStoredTitle(view));
      } catch {
        // Session entries that no longer exist are ignored.
      }
    }
    const active =
      views.find((view) => view.root === activeRoot) ??
      views[views.length - 1] ??
      null;
    setWorkspaces(views);
    setWorkspace(active);
    setActiveMapId(active?.maps[0]?.id ?? null);
    setSelected(active?.maps[0]?.root ?? null);
    if (views.length === 0) {
      dockRef.current?.resetLayout();
    }
    appendLog("恢复上次知识库会话");
    return true;
  }

  async function openOnlyWorkspace(path: string) {
    setWorkspaces([]);
    setWorkspace(null);
    setActiveMapId(null);
    setSelected(null);
    dockRef.current?.resetLayout();
    await openWorkspacePath(path);
  }

  async function openDemo() {
    if (!confirmDiscard()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await workspaceService.demo();
      await openWorkspacePath(path);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

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
          autoOpened.current = true;
          await openOnlyWorkspace(path);
          return;
        }
        if (!initialized) {
          initialized = true;
          const restored = await restoreSession();
          sessionReady.current = true;
          if (!restored) {
            autoOpened.current = true;
            await openDemo();
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
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        roots: workspaces.map((item) => item.root),
        active: workspace?.root ?? null,
      }),
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

  function selectNode(node: NodeView) {
    if (node.id !== selected?.id && !confirmDiscard()) {
      return;
    }
    if (!activeMap) {
      return;
    }
    setSelected(node);
    appendLog(`打开节点：${node.title}`);
    dockRef.current?.openDocument(activeMap.id, node.id, node.title);
  }

  function switchMap(map: MapView, workspaceRoot?: string) {
    if (!confirmDiscard()) {
      return;
    }
    const targetRoot = workspaceRoot ?? workspace?.root;
    const targetWorkspace = workspaces.find(
      (item) => item.root === targetRoot,
    );
    if (targetWorkspace) {
      setWorkspace(targetWorkspace);
    }
    setActiveMapId(map.id);
    setSelected(map.root);
    appendLog(`切换导图：${map.title}`);
    dockRef.current?.openMap(map.id, targetRoot);
  }

  function activateWorkspace(root: string) {
    const target = workspaces.find((item) => item.root === root);
    if (!target) {
      return;
    }
    setWorkspace(target);
    setActiveMapId(target.maps[0]?.id ?? null);
    setSelected(target.maps[0]?.root ?? null);
  }

  function unloadWorkspace(root: string) {
    const target = workspaces.find((item) => item.root === root) ?? null;
    dockRef.current?.closeWorkspacePanels(root, target);
    setWorkspaces((current) => current.filter((item) => item.root !== root));
    if (workspace?.root === root) {
      const remaining = workspaces.filter((item) => item.root !== root);
      const next = remaining[remaining.length - 1] ?? null;
      setWorkspace(next);
      setActiveMapId(next?.maps[0]?.id ?? null);
      setSelected(next?.maps[0]?.root ?? null);
    }
    appendLog(`卸载知识库：${root}`);
  }

  function renameWorkspaceDisplay(root: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    window.localStorage.setItem(
      `tauri-notes.workspace-title:${root}`,
      nextTitle,
    );
    setWorkspaces((current) =>
      current.map((item) =>
        item.root === root ? { ...item, title: nextTitle } : item,
      ),
    );
    setWorkspace((current) =>
      current?.root === root ? { ...current, title: nextTitle } : current,
    );
  }

  function openSearchHit(hit: SearchHit) {
    if (!workspace) {
      return;
    }
    if (!confirmDiscard()) {
      return;
    }
    const map = workspace.maps.find((item) => item.id === hit.mapId);
    const node = map ? findNode(map.root, hit.nodeId) : null;
    if (!map || !node) {
      setError("搜索结果对应的节点不存在");
      return;
    }
    setSearchOpen(false);
    setActiveMapId(map.id);
    setSelected(node);
    appendLog(`搜索打开：${node.title}`);
    dockRef.current?.openDocument(map.id, node.id, node.title);
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Notes</span>
        </div>
        <div className="toolbar-menus">
          <div className="toolbar-menu">
            <button
              type="button"
              className={navbarMenu === "knowledge" ? "active" : ""}
              onClick={() =>
                setNavbarMenu((current) =>
                  current === "knowledge" ? null : "knowledge",
                )
              }
            >
              知识库 ▾
            </button>
            {navbarMenu === "knowledge" && (
              <div className="toolbar-popover">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("knowledge.create");
                  }}
                >
                  新建知识库…
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("knowledge.open");
                  }}
                >
                  打开知识库…
                </button>
                <button
                  type="button"
                  disabled={busy || !workspace}
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("knowledge.backup");
                  }}
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("association.set");
                  }}
                >
                  设置 .note 文件关联
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("association.clear");
                  }}
                >
                  清除 .note 文件关联
                </button>
              </div>
            )}
          </div>
          <div className="toolbar-menu">
            <button
              type="button"
              className={navbarMenu === "view" ? "active" : ""}
              onClick={() =>
                setNavbarMenu((current) =>
                  current === "view" ? null : "view",
                )
              }
            >
              视图 ▾
            </button>
            {navbarMenu === "view" && (
              <div className="toolbar-popover">
                <button
                  type="button"
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("view.outline");
                  }}
                >
                  大纲
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("view.console");
                  }}
                >
                  控制台
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNavbarMenu(null);
                    runNavCommand("view.reset-layout");
                  }}
                >
                  重置布局
                </button>
              </div>
            )}
          </div>
          <div className="toolbar-menu">
            <button
              type="button"
              className={navbarMenu === "theme" ? "active" : ""}
              onClick={() =>
                setNavbarMenu((current) =>
                  current === "theme" ? null : "theme",
                )
              }
            >
              主题 ▾
            </button>
            {navbarMenu === "theme" && (
              <ThemeMenu onClose={() => setNavbarMenu(null)} />
            )}
          </div>
        </div>
        <div className={`backend ${backend.startsWith("未") ? "offline" : "online"}`}>
          {backend}
        </div>
      </header>

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
              logs={logs}
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
    </div>
  );
}

export default App;
