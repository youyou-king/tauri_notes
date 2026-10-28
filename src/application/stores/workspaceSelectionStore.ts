import { create } from "zustand";
import type { NodeView } from "../../types";

type WorkspaceSelectionState = {
  activeMapId: string | null;
  selectedNode: NodeView | null;
  setActiveMapId: (mapId: string | null) => void;
  setSelectedNode: (node: NodeView | null) => void;
};

export const useWorkspaceSelectionStore = create<WorkspaceSelectionState>(
  (set) => ({
    activeMapId: null,
    selectedNode: null,
    setActiveMapId: (activeMapId) => set({ activeMapId }),
    setSelectedNode: (selectedNode) => set({ selectedNode }),
  }),
);
