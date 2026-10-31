import type { RefObject } from "react";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { findNode } from "../domain/tree";
import type { MapView, NodeView, SearchHit, WorkspaceView } from "../types";
import { writeWorkspaceTitle } from "../application/sessionService";

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
    dockRef.current?.openDocument(activeMap.id, node.id, node.title);
  }

  async function switchMap(map: MapView, workspaceRoot?: string) {
    if (!(await confirmDiscard())) {
      return;
    }
    const targetRoot = workspaceRoot ?? workspace?.root;
    const targetWorkspace = workspaces.find(
      (item) => item.root === targetRoot,
    );
    if (targetWorkspace) {
      setWorkspace(targetWorkspace);
    }
    select(map.id, map.root);
    appendLog(`切换导图：${map.title}`);
    dockRef.current?.openMap(map.id, targetRoot);
  }

  function activateWorkspace(root: string) {
    const target = workspaces.find((item) => item.root === root);
    if (!target) {
      return;
    }
    setWorkspace(target);
    select(
      target.maps[0]?.id ?? null,
      target.maps[0]?.root ?? null,
    );
  }

  function unloadWorkspace(root: string) {
    const target = workspaces.find((item) => item.root === root) ?? null;
    dockRef.current?.closeWorkspacePanels(root, target);
    setWorkspaces((current) =>
      current.filter((item) => item.root !== root),
    );
    if (workspace?.root === root) {
      const remaining = workspaces.filter((item) => item.root !== root);
      const next = remaining[remaining.length - 1] ?? null;
      setWorkspace(next);
      select(
        next?.maps[0]?.id ?? null,
        next?.maps[0]?.root ?? null,
      );
    }
    appendLog(`卸载知识库：${root}`);
  }

  function renameWorkspaceDisplay(root: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    writeWorkspaceTitle(root, nextTitle);
    setWorkspaces((current) =>
      current.map((item) =>
        item.root === root ? { ...item, title: nextTitle } : item,
      ),
    );
    setWorkspace((current) =>
      current?.root === root ? { ...current, title: nextTitle } : current,
    );
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
    dockRef.current?.openDocument(map.id, node.id, node.title);
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
