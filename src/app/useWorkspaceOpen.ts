import type { LibraryPort } from "../application/ports/libraryPort";
import type { WorkspacePresenter } from "../application/ports/workspacePresenterPort";
import type { DialogPort } from "../application/ports/dialogPort";
import { findNode } from "../domain/tree";
import { loadLibraryStatus } from "../infrastructure/libraryStatus";
import { libraryService } from "../application/libraryService";
import { workspaceService } from "../application/workspaceService";
import {
  buildDatabaseTree,
  mergeDatabaseDocuments,
} from "../application/workspaceTree";
import { readSession } from "../application/sessionService";
import type { WorkspaceView } from "../types";
import type { MissingLibrary } from "../application/stores/workspaceStore";

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
  setMissingLibraries: (
    next:
      | MissingLibrary[]
      | ((current: MissingLibrary[]) => MissingLibrary[]),
  ) => void;
  select: (
    mapId: string | null,
    node: WorkspaceView["maps"][number]["root"] | null,
  ) => void;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  appendLog: (line: string) => void;
  confirmDiscard: () => Promise<boolean>;
  dialogs: DialogPort;
  library: LibraryPort;
  workspacePresenter: WorkspacePresenter;
};

export function useWorkspaceOpen({
  workspace,
  workspaces,
  rememberWorkspace,
  setWorkspace,
  setWorkspaces,
  setMissingLibraries,
  select,
  setBusy,
  setError,
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
      const path = await workspaceService.backup(
        workspace.id,
        workspace.root,
        note,
      );
      appendLog(`数据库备份：${path}`);
    } catch (error) {
      setError(`备份失败：${String(error)}`);
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
      const view = await libraryService.register(picked);
      setMissingLibraries((current) =>
        current.filter(
          (item) => item.id !== view.id && item.path !== view.root,
        ),
      );
      const map = view.maps[0] ?? null;
      const root = map?.root ?? null;
      if (!isNote && root) {
        await loadLibraryStatus(view.id);
      }
      if (isNote) {
        rememberWorkspace(view);
      } else {
        const databaseDocuments =
          await workspaceService.listDocuments(view.id);
        const treeRows = await workspaceService.loadDocumentTree(view.id);
        rememberWorkspace(
          treeRows.length > 0
            ? buildDatabaseTree(view, treeRows)
            : mergeDatabaseDocuments(view, databaseDocuments),
        );
      }
      select(map?.id ?? null, root);
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
      const replacing = workspaces.some((item) => item.root === picked);
      setWorkspaces((current) =>
        current.filter((item) => item.root !== picked),
      );
      if (replacing) {
        workspacePresenter.resetLayout();
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
      setError(String(error));
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

  async function restoreSession(): Promise<boolean> {
    const session = readSession();
    if (!session) {
      return false;
    }
    const candidates = [
      ...session.libraries,
      ...session.missing.map((item) => ({
        id: item.id,
        path: item.path,
      })),
    ];
    const seen = new Set<string>();
    const libraries = candidates.filter((item) => {
      if (seen.has(item.path)) {
        return false;
      }
      seen.add(item.path);
      return true;
    });
    const views: WorkspaceView[] = [];
    const missing: MissingLibrary[] = [];
    for (const library of libraries) {
      try {
        const view = library.id
          ? await libraryService.open(library.id)
          : await libraryService.register(library.path);
        views.push(view);
      } catch (error) {
        // ID 失效（移动/复制）时按路径重新登记一次。
        try {
          views.push(await libraryService.register(library.path));
        } catch (fallbackError) {
          missing.push({
            id: library.id,
            path: library.path,
            reason: String(fallbackError || error),
          });
        }
      }
    }
    const active =
      views.find((view) => view.id === session.activeId) ??
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
    setMissingLibraries(missing);
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

  async function relocateMissing(item: MissingLibrary): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const picked = await library.pickExisting();
      if (!picked) {
        return;
      }
      const view = item.id
        ? await libraryService.relocate(item.id, picked)
        : await libraryService.register(picked);
      rememberWorkspace(view);
      setWorkspace(view);
      select(view.maps[0]?.id ?? null, view.maps[0]?.root ?? null);
      workspacePresenter.present(view, /\.note$/i.test(view.root));
      setMissingLibraries((current) =>
        current.filter((entry) => entry.path !== item.path),
      );
      appendLog(`重新定位书库：${view.title}`);
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function forgetMissing(item: MissingLibrary): Promise<void> {
    try {
      if (item.id) {
        await libraryService.forget(item.id);
      }
      setMissingLibraries((current) =>
        current.filter((entry) => entry.path !== item.path),
      );
      appendLog(`移除失效书库：${item.path}`);
    } catch (error) {
      setError(String(error));
    }
  }

  return {
    backupLibrary,
    openWorkspacePath,
    createKnowledgeBase,
    openWorkspace,
    openHelp,
    restoreSession,
    openOnlyWorkspace,
    relocateMissing,
    forgetMissing,
  };
}
