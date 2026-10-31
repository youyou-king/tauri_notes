import {
  usePanelStore,
  type PanelLifecycle,
} from "../../application/stores/panelStore";

export type { PanelLifecycle };

export function setPanelStatus(
  panelId: string,
  status: PanelLifecycle,
): void {
  usePanelStore.getState().setPanelStatus(panelId, status);
}
