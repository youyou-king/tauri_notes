import { create } from "zustand";
import type { LibraryId, WorkspaceView } from "../../types";

type Updater<T> = T | ((current: T) => T);

export type MissingLibrary = {
  id: LibraryId | null;
  path: string;
  reason: string;
};

function resolve<T>(next: Updater<T>, current: T): T {
  return typeof next === "function"
    ? (next as (value: T) => T)(current)
    : next;
}

type WorkspaceState = {
  workspaces: WorkspaceView[];
  missingLibraries: MissingLibrary[];
  /** 当前书库只按稳定 id 识别；路径只用于打开/显示。 */
  activeId: LibraryId | null;
  setWorkspaces: (next: Updater<WorkspaceView[]>) => void;
  setMissingLibraries: (next: Updater<MissingLibrary[]>) => void;
  setActiveWorkspace: (next: Updater<WorkspaceView | null>) => void;
};

export function selectActiveWorkspace(
  state: Pick<WorkspaceState, "workspaces" | "activeId">,
): WorkspaceView | null {
  return state.activeId
    ? (state.workspaces.find((item) => item.id === state.activeId) ?? null)
    : null;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  missingLibraries: [],
  activeId: null,
  setWorkspaces: (next) =>
    set((state) => {
      const workspaces = resolve(next, state.workspaces);
      const active = selectActiveWorkspace({
        workspaces,
        activeId: state.activeId,
      });
      return {
        workspaces,
        activeId: active?.id ?? null,
      };
    }),
  setMissingLibraries: (next) =>
    set((state) => ({
      missingLibraries: resolve(next, state.missingLibraries),
    })),
  setActiveWorkspace: (next) =>
    set((state) => {
      const current = selectActiveWorkspace(state);
      const active = resolve(next, current);
      return {
        activeId: active?.id ?? null,
      };
    }),
}));
