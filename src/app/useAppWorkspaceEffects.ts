import { useEffect } from "react";
import { workspaceService } from "../application/workspaceService";
import { writeSession } from "../application/sessionService";
import { ensureLibrary } from "../infrastructure/libraryBootstrapper";
import { APP_EVENTS, onAppEvent } from "../kernel/events";
import type { WorkspaceView } from "../types";

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
  useEffect(() => {
    if (!root) {
      return;
    }
    return onAppEvent(APP_EVENTS.mapsChanged, (detail) => {
      const targetRoot = detail?.root ?? root;
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
    });
  }, [root, setError, setWorkspace, setWorkspaces]);
}

export function useLibraryBootstrap(
  workspaceRoot: string | null,
  appendLog: (line: string) => void,
): void {
  useEffect(() => {
    window.__TAURI_WORKSPACE_ROOT__ = workspaceRoot ?? "";
    if (!workspaceRoot || /\.note$/i.test(workspaceRoot)) {
      return;
    }
    void ensureLibrary(workspaceRoot)
      .then((status) => {
        appendLog(
          `正式库就绪：${status.documents} 文档 / ${status.blocks} 块 / ${status.references} 引用`,
        );
      })
      .catch((error) => {
        appendLog(`正式库初始化失败：${String(error)}`);
      });
  }, [appendLog, workspaceRoot]);
}

export function useSessionPersistence(input: {
  sessionReady: { current: boolean };
  workspaces: WorkspaceView[];
  workspaceRoot: string | null;
  activeMapId: string | null;
  selectedNodeId: string | null;
  activePanelId: string | null;
}): void {
  const {
    sessionReady,
    workspaces,
    workspaceRoot,
    activeMapId,
    selectedNodeId,
    activePanelId,
  } = input;
  useEffect(() => {
    if (!sessionReady.current) {
      return;
    }
    writeSession(
      workspaces.map((item) => item.root),
      workspaceRoot,
      { activeMapId, selectedNodeId, activePanelId },
    );
  }, [
    activeMapId,
    activePanelId,
    selectedNodeId,
    sessionReady,
    workspaces,
    workspaceRoot,
  ]);
}
