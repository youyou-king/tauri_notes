import type { RefObject } from "react";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { findNode } from "../domain/tree";
import type { MapView, NodeView, SearchHit, WorkspaceView } from "../types";
import { libraryService } from "../application/libraryService";
import { workspaceService } from "../application/workspaceService";

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
  activeMap: MapView | null;
  selected: NodeView | null;
  setWorkspace: WorkspaceUpdater;
  setWorkspaces: WorkspacesUpdater;
  setSelected: (node: NodeView | null) => void;
  select: (mapId: string | null, node: NodeView | null) => void;
  appendLog: (line: string) => void;
  confirmDiscard: () => Promise<boolean>;
  setError: (message: string) => void;
  dockRef: RefObject<DockWorkspaceHandle | null>;
};

export function useWorkspaceNavigation({
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
}: Args) {
  async function selectNode(node: NodeView) {
    if (node.id !== selected?.id && !(await confirmDiscard())) {
      return;
    }
    if (!activeMap) {
      return;
    }
    setSelected(node);
    appendLog(`打开节点：${node.title}`);
    dockRef.current?.openDocument(
      activeMap.id,
      node.id,
      node.title,
      workspace?.id,
    );
  }

  async function switchMap(map: MapView, libraryId?: string) {
    if (!(await confirmDiscard())) {
      return;
    }
    const targetWorkspace = workspaces.find(
      (item) => item.id === (libraryId ?? workspace?.id),
    );
    if (targetWorkspace) {
      setWorkspace(targetWorkspace);
    }
    select(map.id, map.root);
    appendLog(`切换导图：${map.title}`);
    dockRef.current?.openMap(map.id, targetWorkspace?.id ?? workspace?.id);
  }

  function activateWorkspace(libraryId: string) {
    const target = workspaces.find((item) => item.id === libraryId);
    if (!target) {
      return;
    }
    setWorkspace(target);
    select(
      target.maps[0]?.id ?? null,
      target.maps[0]?.root ?? null,
    );
  }

  async function unloadWorkspace(libraryId: string) {
    if (!(await confirmDiscard())) {
      return;
    }
    const target = workspaces.find((item) => item.id === libraryId) ?? null;
    if (!target) {
      return;
    }
    await workspaceService.closeDatabase(target.id).catch(() => {});
    dockRef.current?.closeWorkspacePanels(target.id, target);
    setWorkspaces((current) =>
      current.filter((item) => item.id !== libraryId),
    );
    if (workspace?.id === libraryId) {
      const remaining = workspaces.filter(
        (item) => item.id !== libraryId,
      );
      const next = remaining[remaining.length - 1] ?? null;
      setWorkspace(next);
      select(
        next?.maps[0]?.id ?? null,
        next?.maps[0]?.root ?? null,
      );
    }
    appendLog(`卸载知识库：${target.title}`);
  }

  async function renameWorkspaceDisplay(libraryId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    try {
      const view = await libraryService.rename(libraryId, nextTitle);
      setWorkspaces((current) =>
        current.map((item) => (item.id === view.id ? view : item)),
      );
      setWorkspace((current) =>
        current?.id === view.id ? view : current,
      );
      appendLog(`重命名知识库：${view.title}`);
    } catch (error) {
      setError(String(error));
    }
  }

  async function openSearchHit(hit: SearchHit) {
    if (!workspace) {
      return;
    }
    if (!(await confirmDiscard())) {
      return;
    }
    const map = workspace.maps.find((item) => item.id === hit.mapId);
    const node = map ? findNode(map.root, hit.nodeId) : null;
    if (!map || !node) {
      setError("搜索结果对应的节点不存在");
      return;
    }
    select(map.id, node);
    appendLog(`搜索打开：${node.title}`);
    dockRef.current?.openDocument(map.id, node.id, node.title, workspace.id);
  }

  return {
    selectNode,
    switchMap,
    activateWorkspace,
    unloadWorkspace,
    renameWorkspaceDisplay,
    openSearchHit,
  };
}
