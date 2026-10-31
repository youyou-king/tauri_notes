import { beforeEach, describe, expect, it } from "vitest";
import type { WorkspaceView } from "../../types";
import {
  selectActiveWorkspace,
  useWorkspaceStore,
} from "./workspaceStore";
import { useWorkspaceSelectionStore } from "./workspaceSelectionStore";
import { usePanelStore } from "./panelStore";

const workspace = (root: string, title: string): WorkspaceView =>
  ({ root, title, maps: [] }) as WorkspaceView;

describe("workspace stores", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspaces: [], activeRoot: null });
    useWorkspaceSelectionStore.setState({
      activeMapId: null,
      selectedNode: null,
    });
    usePanelStore.setState({ dirtyPanels: {} });
  });

  it("derives the active workspace from activeRoot", () => {
    const view = workspace("/tmp/a.note", "A");
    useWorkspaceStore.getState().setWorkspaces([view]);
    useWorkspaceStore.getState().setActiveWorkspace(view);
    expect(useWorkspaceStore.getState().workspaces).toEqual([view]);
    expect(selectActiveWorkspace(useWorkspaceStore.getState())).toBe(view);
  });

  it("keeps the active workspace in sync when its title changes", () => {
    const view = workspace("/tmp/a.note", "A");
    useWorkspaceStore.getState().setWorkspaces([view]);
    useWorkspaceStore.getState().setActiveWorkspace(view);
    useWorkspaceStore.getState().setWorkspaces((current) =>
      current.map((item) =>
        item.root === view.root ? { ...item, title: "A2" } : item,
      ),
    );
    expect(selectActiveWorkspace(useWorkspaceStore.getState())?.title).toBe(
      "A2",
    );
  });

  it("clears activeRoot when the active workspace is removed", () => {
    const view = workspace("/tmp/a.note", "A");
    useWorkspaceStore.getState().setWorkspaces([view]);
    useWorkspaceStore.getState().setActiveWorkspace(view);
    useWorkspaceStore.getState().setWorkspaces([]);
    expect(useWorkspaceStore.getState().activeRoot).toBeNull();
    expect(selectActiveWorkspace(useWorkspaceStore.getState())).toBeNull();
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
