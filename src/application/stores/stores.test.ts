import { beforeEach, describe, expect, it } from "vitest";
import type { WorkspaceView } from "../../types";
import { useWorkspaceStore } from "./workspaceStore";
import { useWorkspaceSelectionStore } from "./workspaceSelectionStore";
import { usePanelStore } from "./panelStore";

const workspace = (root: string, title: string): WorkspaceView =>
  ({ root, title, maps: [] }) as WorkspaceView;

describe("workspace stores", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspaces: [], activeWorkspace: null });
    useWorkspaceSelectionStore.setState({
      activeMapId: null,
      selectedNode: null,
    });
    usePanelStore.setState({ dirtyPanels: {} });
  });

  it("stores workspaces and active workspace independently", () => {
    const view = workspace("/tmp/a.note", "A");
    useWorkspaceStore.getState().setWorkspaces([view]);
    useWorkspaceStore.getState().setActiveWorkspace(view);
    expect(useWorkspaceStore.getState().workspaces).toEqual([view]);
    expect(useWorkspaceStore.getState().activeWorkspace).toBe(view);
  });

  it("supports functional updates", () => {
    useWorkspaceStore.getState().setWorkspaces([workspace("/tmp/a", "A")]);
    useWorkspaceStore.getState().setWorkspaces((current) => [
      ...current,
      workspace("/tmp/b", "B"),
    ]);
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(2);
  });

  it("tracks selection", () => {
    useWorkspaceSelectionStore.getState().setActiveMapId("map-1");
    useWorkspaceSelectionStore.getState().setSelectedNode(null);
    expect(useWorkspaceSelectionStore.getState().activeMapId).toBe("map-1");
  });

  it("tracks dirty panels", () => {
    usePanelStore.getState().setPanelDirty("doc:1", true);
    expect(usePanelStore.getState().dirtyPanels["doc:1"]).toBe(true);
    usePanelStore.getState().setPanelDirty("doc:1", false);
    expect(usePanelStore.getState().dirtyPanels["doc:1"]).toBeUndefined();
  });
});
