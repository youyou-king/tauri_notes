import { beforeEach, describe, expect, it } from "vitest";
import type { NodeView, WorkspaceView } from "../../../../src/types";
import { asLibraryPath } from "../../../../src/types";
import {
  selectActiveWorkspace,
  useWorkspaceStore,
} from "../../../../src/application/stores/workspaceStore";
import { useWorkspaceSelectionStore } from "../../../../src/application/stores/workspaceSelectionStore";
import { usePanelStore } from "../../../../src/application/stores/panelStore";

const workspace = (root: string, title: string): WorkspaceView =>
  ({
    id: `lib_${root}`,
    root: asLibraryPath(root),
    title,
    maps: [],
  }) as WorkspaceView;

describe("workspace stores", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      missingLibraries: [],
      activeId: null,
    });
    useWorkspaceSelectionStore.setState({
      activeMapId: null,
      selectedNode: null,
    });
    usePanelStore.setState({ dirtyPanels: {}, panelStatus: {} });
  });

  it("derives the active workspace from activeId", () => {
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

  it("clears activeId when the active workspace is removed", () => {
    const view = workspace("/tmp/a.note", "A");
    useWorkspaceStore.getState().setWorkspaces([view]);
    useWorkspaceStore.getState().setActiveWorkspace(view);
    useWorkspaceStore.getState().setWorkspaces([]);
    expect(useWorkspaceStore.getState().activeId).toBeNull();
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
    useWorkspaceSelectionStore.getState().select("map-1", null);
    expect(useWorkspaceSelectionStore.getState().activeMapId).toBe("map-1");
  });

  it("updates map and node atomically", () => {
    const node = { id: "node-1", title: "Node" } as NodeView;
    useWorkspaceSelectionStore.getState().select("map-1", node);
    expect(useWorkspaceSelectionStore.getState().activeMapId).toBe("map-1");
    expect(useWorkspaceSelectionStore.getState().selectedNode).toBe(node);
    useWorkspaceSelectionStore.getState().select(null, null);
    expect(useWorkspaceSelectionStore.getState().activeMapId).toBeNull();
    expect(useWorkspaceSelectionStore.getState().selectedNode).toBeNull();
  });

  it("tracks dirty panels", () => {
    usePanelStore.getState().setPanelDirty("doc:1", true);
    expect(usePanelStore.getState().dirtyPanels["doc:1"]).toBe(true);
    expect(usePanelStore.getState().panelStatus["doc:1"]).toBe("dirty");
    usePanelStore.getState().setPanelStatus("doc:1", "saving");
    expect(usePanelStore.getState().panelStatus["doc:1"]).toBe("saving");
    usePanelStore.getState().setPanelDirty("doc:1", false);
    expect(usePanelStore.getState().dirtyPanels["doc:1"]).toBeUndefined();
  });
});
