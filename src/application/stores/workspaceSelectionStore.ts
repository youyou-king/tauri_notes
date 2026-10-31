import { create } from "zustand";
import type { NodeView } from "../../types";

type WorkspaceSelectionState = {
  activeMapId: string | null;
  selectedNode: NodeView | null;
  setSelectedNode: (node: NodeView | null) => void;
  select: (mapId: string | null, node: NodeView | null) => void;
};

export const useWorkspaceSelectionStore = create<WorkspaceSelectionState>(
  (set) => ({
    activeMapId: null,
    selectedNode: null,
    setSelectedNode: (selectedNode) => set({ selectedNode }),
    select: (activeMapId, selectedNode) =>
      set({ activeMapId, selectedNode }),
  }),
);
