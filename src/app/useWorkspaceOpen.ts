import type { RefObject } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { ensureLibrary } from "../infrastructure/libraryBootstrapper";
import { workspaceService } from "../application/workspaceService";
import {
  buildDatabaseTree,
  mergeDatabaseDocuments,
} from "../application/workspaceTree";
import {
  clearWorkspaceTitle,
  readSession,
  readWorkspaceTitle,
} from "../application/sessionService";
import type { WorkspaceView } from "../types";

type WorkspaceUpdater = (
  next:
    | WorkspaceView
    | null
    | ((current: WorkspaceView | null) => WorkspaceView | null),
) => void;

type WorkspacesUpdater = (
  next:
    | WorkspaceView[]
    | ((current: WorkspaceView[]) => WorkspaceView[]),
) => void;

type Args = {
  workspace: WorkspaceView | null;
  workspaces: WorkspaceView[];
  rememberWorkspace: (view: WorkspaceView) => void;
  setWorkspace: WorkspaceUpdater;
  setWorkspaces: WorkspacesUpdater;
  setActiveMapId: (mapId: string | null) => void;
  setSelected: (node: WorkspaceView["maps"][number]["root"] | null) => void;
  renameWorkspaceDisplay: (root: string, title: string) => void;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  setBackend: (message: string) => void;
  appendLog: (line: string) => void;
  confirmDiscard: () => Promise<boolean>;
  dockRef: RefObject<DockWorkspaceHandle | null>;
};

async function defaultNotePath(): Promise<string> {
  const lastDirectory = window.localStorage.getItem(
    "tauri-notes.last-note-directory",
  );
  if (lastDirectory) {
    return join(lastDirectory, "未命名.note");
  }
  return join(await appDataDir(), "knowledge", "未命名.note");
}

function isDemoRoot(root: string): boolean {
  return /(^|[\\/])sample\.notes[\\/]*$/i.test(root.trim());
}

export function useWorkspaceOpen({
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
}: Args) {
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
    if (!(await confirmDiscard())) {
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
      const storedTitle = readWorkspaceTitle(view.root);
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
        dockRef.current?.openDocument(
          map.id,
          root.id,
          root.title,
          view.root,
        );
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
      clearWorkspaceTitle(picked);
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
    if (!(await confirmDiscard())) {
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
    const stored = readWorkspaceTitle(view.root);
    return stored ? { ...view, title: stored } : view;
  }

  async function restoreSession(): Promise<boolean> {
    const session = readSession();
    if (!session) {
      return false;
    }
    const { activeRoot } = session;
    const roots = session.roots.filter((root) => !isDemoRoot(root));
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
      return false;
    }
    appendLog("恢复上次知识库会话");
    return true;
  }

  async function openHelp() {
    setError(null);
    try {
      const path = await workspaceService.helpPath();
      await openWorkspacePath(path);
    } catch (err) {
      setError(String(err));
    }
  }

  async function openOnlyWorkspace(path: string) {
    setWorkspaces([]);
    setWorkspace(null);
    setActiveMapId(null);
    setSelected(null);
    dockRef.current?.resetLayout();
    await openWorkspacePath(path);
  }

  return {
    backupLibrary,
    openWorkspacePath,
    createKnowledgeBase,
    openWorkspace,
    openHelp,
    restoreSession,
    openOnlyWorkspace,
  };
}
