import { create } from "zustand";

type PanelState = {
  dirtyPanels: Record<string, boolean>;
  setPanelDirty: (panelId: string, dirty: boolean) => void;
  clearDirtyPanels: () => void;
};

export const usePanelStore = create<PanelState>((set) => ({
  dirtyPanels: {},
  setPanelDirty: (panelId, dirty) =>
    set((state) => {
      if (Boolean(state.dirtyPanels[panelId]) === dirty) {
        return state;
      }
      const next = { ...state.dirtyPanels };
      if (dirty) {
        next[panelId] = true;
      } else {
        delete next[panelId];
      }
      return { dirtyPanels: next };
    }),
  clearDirtyPanels: () => set({ dirtyPanels: {} }),
}));
