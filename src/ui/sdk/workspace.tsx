import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  selectActiveWorkspace,
  useWorkspaceStore,
} from "../../application/stores/workspaceStore";
import type { WorkspaceView } from "../../types";

export type WorkspacePort = {
  activeWorkspace: WorkspaceView | null;
  workspaces: WorkspaceView[];
};

const WorkspacePortContext = createContext<WorkspacePort>({
  activeWorkspace: null,
  workspaces: [],
});

export function WorkspaceBridge({ children }: { children: ReactNode }) {
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  return (
    <WorkspacePortContext.Provider
      value={{ activeWorkspace, workspaces }}
    >
      {children}
    </WorkspacePortContext.Provider>
  );
}

export function useWorkspacePort(): WorkspacePort {
  return useContext(WorkspacePortContext);
}
