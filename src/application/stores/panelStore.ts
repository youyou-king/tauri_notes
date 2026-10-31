import { create } from "zustand";

export type PanelLifecycle =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

type PanelState = {
  dirtyPanels: Record<string, boolean>;
  panelStatus: Record<string, PanelLifecycle>;
  setPanelDirty: (panelId: string, dirty: boolean) => void;
  setPanelStatus: (panelId: string, status: PanelLifecycle) => void;
  clearDirtyPanels: () => void;
};

export const usePanelStore = create<PanelState>((set) => ({
  dirtyPanels: {},
  panelStatus: {},
  setPanelDirty: (panelId, dirty) =>
    set((state) => {
      const alreadyDirty = Boolean(state.dirtyPanels[panelId]);
      if (alreadyDirty === dirty) {
        return state;
      }
      const dirtyPanels = { ...state.dirtyPanels };
      if (dirty) {
        dirtyPanels[panelId] = true;
      } else {
        delete dirtyPanels[panelId];
      }
      return {
        dirtyPanels,
        panelStatus: dirty
          ? { ...state.panelStatus, [panelId]: "dirty" }
          : state.panelStatus,
      };
    }),
  setPanelStatus: (panelId, status) =>
    set((state) => ({
      panelStatus: { ...state.panelStatus, [panelId]: status },
    })),
  clearDirtyPanels: () =>
    set({ dirtyPanels: {}, panelStatus: {} }),
}));
