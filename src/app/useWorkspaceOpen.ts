import type { LibraryPort } from "../application/ports/libraryPort";
import type { WorkspacePresenter } from "../application/ports/workspacePresenterPort";
import type { DialogPort } from "../application/ports/dialogPort";
import { findNode } from "../domain/tree";
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
  select: (
    mapId: string | null,
    node: WorkspaceView["maps"][number]["root"] | null,
  ) => void;
  renameWorkspaceDisplay: (root: string, title: string) => void;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  setBackend: (message: string) => void;
  appendLog: (line: string) => void;
  confirmDiscard: () => Promise<boolean>;
  dialogs: DialogPort;
  library: LibraryPort;
  workspacePresenter: WorkspacePresenter;
};

function isDemoRoot(root: string): boolean {
  return /(^|[\\/])sample\.notes[\\/]*$/i.test(root.trim());
}

export function useWorkspaceOpen({
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
  dialogs,
  library,
  workspacePresenter,
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

  async function openWorkspacePath(
    picked: string,
    options: { skipDiscardCheck?: boolean } = {},
  ) {
    if (!options.skipDiscardCheck && !(await confirmDiscard())) {
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
      select(map?.id ?? null, root);
      setBackend(`已打开：${view.title}（${view.maps.length} 张导图）`);
      appendLog(`打开知识库：${view.title}`);
      workspacePresenter.present(view, isNote);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createKnowledgeBase() {
    if (!(await confirmDiscard())) {
      return;
    }
    setError(null);
    let pickedPath: string | null = null;
    try {
      let title: string | null = null;
      if (library.managed) {
        title = await dialogs.prompt({
          title: "新建知识库",
          defaultValue: "未命名",
        });
        if (!title?.trim()) {
          return;
        }
        title = title.trim();
      }
      const picked = await library.pickNew(title ?? undefined);
      if (!picked) {
        return;
      }
      pickedPath = picked;
      clearWorkspaceTitle(picked);
      const replacing = workspaces.some((item) => item.root === picked);
      setWorkspaces((current) =>
        current.filter((item) => item.root !== picked),
      );
      if (replacing) {
        workspacePresenter.resetLayout();
      } else {
        workspacePresenter.closeWorkspace(picked);
      }
      const view = await workspaceService.createNoteFile(
        picked,
        title ??
          picked.split(/[\\/]/).pop()?.replace(/\.note$/i, "") ??
          "知识库",
      );
      const directory = picked.replace(/[\\/][^\\/]+$/, "");
      window.localStorage.setItem(
        "tauri-notes.last-note-directory",
        directory,
      );
      await openWorkspacePath(view.root, { skipDiscardCheck: true });
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
      const picked = await library.pickExisting();
      if (!picked) {
        return;
      }
      await openWorkspacePath(picked, { skipDiscardCheck: true });
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
    const restoredMap =
      active?.maps.find((map) => map.id === session.activeMapId) ??
      active?.maps[0] ??
      null;
    const restoredNode =
      (restoredMap && session.selectedNodeId
        ? findNode(restoredMap.root, session.selectedNodeId)
        : null) ??
      restoredMap?.root ??
      null;
    setWorkspaces(views);
    setWorkspace(active);
    select(restoredMap?.id ?? null, restoredNode);
    if (session.activePanelId) {
      workspacePresenter.activatePanel(session.activePanelId);
    }
    if (views.length === 0) {
      workspacePresenter.resetLayout();
      return false;
    }
    appendLog("恢复上次知识库会话");
    return true;
  }

  async function openHelp() {
    if (!(await confirmDiscard())) {
      return;
    }
    setError(null);
    try {
      const path = await workspaceService.helpPath();
      await openWorkspacePath(path, { skipDiscardCheck: true });
    } catch (err) {
      setError(String(err));
    }
  }

  async function openOnlyWorkspace(path: string) {
    if (!(await confirmDiscard())) {
      return;
    }
    setWorkspaces([]);
    setWorkspace(null);
    select(null, null);
    workspacePresenter.resetLayout();
    await openWorkspacePath(path, { skipDiscardCheck: true });
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
