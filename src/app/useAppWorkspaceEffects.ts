import { useEffect } from "react";
import { libraryService } from "../application/libraryService";
import { writeSession } from "../application/sessionService";
import { loadLibraryStatus } from "../infrastructure/libraryStatus";
import { APP_EVENTS, onAppEvent } from "../kernel/events";
import type { LibraryId, WorkspaceView } from "../types";
import { asLibraryPath } from "../types";
import type { MissingLibrary } from "../application/stores/workspaceStore";

type WorkspaceSetter = (
  value:
    | WorkspaceView
    | null
    | ((current: WorkspaceView | null) => WorkspaceView | null),
) => void;

type WorkspacesSetter = (
  value:
    | WorkspaceView[]
    | ((current: WorkspaceView[]) => WorkspaceView[]),
) => void;

export function useMapsChangedRefresh(
  workspace: WorkspaceView | null,
  setWorkspaces: WorkspacesSetter,
  setWorkspace: WorkspaceSetter,
  setError: (message: string) => void,
): void {
  const root = workspace?.root;
  const id = workspace?.id;
  useEffect(() => {
    if (!root || !id) {
      return;
    }
    return onAppEvent(APP_EVENTS.mapsChanged, (detail) => {
      const targetRoot = detail?.root ?? root;
      void (async () => {
        const view =
          targetRoot === root
            ? await libraryService.open(id)
            : await libraryService.register(targetRoot);
        setWorkspaces((current) =>
          current.map((item) => (item.id === view.id ? view : item)),
        );
        setWorkspace((current) =>
          current && current.id === view.id
            ? { ...current, maps: view.maps, title: view.title }
            : current,
        );
      })().catch((reason) => setError(String(reason)));
    });
  }, [id, root, setError, setWorkspace, setWorkspaces]);
}

export function useLibraryBootstrap(
  libraryId: LibraryId | null,
  workspaceRoot: string | null,
  appendLog: (line: string) => void,
): void {
  useEffect(() => {
    window.__TAURI_WORKSPACE_ROOT__ = workspaceRoot ?? "";
    if (!libraryId || !workspaceRoot || /\.note$/i.test(workspaceRoot)) {
      return;
    }
    void loadLibraryStatus(libraryId)
      .then((status) => {
        appendLog(
          `正式库就绪：${status.documents} 文档 / ${status.blocks} 块 / ${status.references} 引用`,
        );
      })
      .catch((error) => {
        appendLog(`正式库初始化失败：${String(error)}`);
      });
  }, [appendLog, libraryId, workspaceRoot]);
}

export function useSessionPersistence(input: {
  sessionReady: { current: boolean };
  workspaces: WorkspaceView[];
  missingLibraries: MissingLibrary[];
  activeId: string | null;
  activeMapId: string | null;
  selectedNodeId: string | null;
  activePanelId: string | null;
}): void {
  const {
    sessionReady,
    workspaces,
    missingLibraries,
    activeId,
    activeMapId,
    selectedNodeId,
    activePanelId,
  } = input;
  useEffect(() => {
    if (!sessionReady.current) {
      return;
    }
    writeSession(
      workspaces
        .filter(
          (item): item is WorkspaceView & { id: string } =>
            typeof item.id === "string" && item.id.length > 0,
        )
        .map((item) => ({ id: item.id, path: item.root })),
      activeId,
      { activeMapId, selectedNodeId, activePanelId },
      missingLibraries.map((item) => ({
        id: item.id,
        path: asLibraryPath(item.path),
      })),
    );
  }, [
    activeId,
    activeMapId,
    activePanelId,
    selectedNodeId,
    sessionReady,
    workspaces,
    missingLibraries,
  ]);
}
