import { createContext, useContext } from "react";
import type {
  BoardControllerPort,
  PinBlockInput,
} from "../../kernel/panel/boardPort";
import type {
  LibraryId,
  MapView,
  NodeView,
  WorkspaceView,
} from "../../types";

export type PanelContextValue = {
  workspace: WorkspaceView | null;
  workspaces: WorkspaceView[];
  activeMap: MapView | null;
  activePanelId: string | null;
  selected: NodeView | null;
  openDocument: (mapId: string, nodeId: string, title?: string) => void;
  openBlockDocument: (
    documentId: string,
    title?: string,
    libraryId?: LibraryId,
  ) => void;
  setPanelDirty: (panelId: string, dirty: boolean) => void;
  onSelectNode: (node: NodeView, newPanel: boolean) => void;
  onSwitchMap: (map: MapView, libraryId?: LibraryId) => void;
  onActivateWorkspace: (libraryId: LibraryId) => void;
  onUnloadWorkspace: (libraryId: LibraryId) => void;
  onRenameWorkspace: (libraryId: LibraryId, title: string) => void;
  onPinBlock: (input: PinBlockInput) => void | Promise<void>;
  board: BoardControllerPort;
  lastActiveDocId: string | null;
};

export const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanelContext(): PanelContextValue | null {
  return useContext(PanelContext);
}
