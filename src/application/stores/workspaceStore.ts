import { create } from "zustand";
import type { WorkspaceView } from "../../types";

type Updater<T> = T | ((current: T) => T);

function resolve<T>(next: Updater<T>, current: T): T {
  return typeof next === "function"
    ? (next as (value: T) => T)(current)
    : next;
}

type WorkspaceState = {
  workspaces: WorkspaceView[];
  /**
   * The active workspace is identified by root only. The WorkspaceView itself
   * is always derived from `workspaces`, so updating a workspace title or map
   * list cannot leave a stale copy behind.
   */
  activeRoot: string | null;
  setWorkspaces: (next: Updater<WorkspaceView[]>) => void;
  setActiveWorkspace: (next: Updater<WorkspaceView | null>) => void;
};

export function selectActiveWorkspace(
  state: Pick<WorkspaceState, "workspaces" | "activeRoot">,
): WorkspaceView | null {
  return (
    state.workspaces.find((item) => item.root === state.activeRoot) ??
    null
  );
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeRoot: null,
  setWorkspaces: (next) =>
    set((state) => {
      const workspaces = resolve(next, state.workspaces);
      return {
        workspaces,
        activeRoot: workspaces.some(
          (item) => item.root === state.activeRoot,
        )
          ? state.activeRoot
          : null,
      };
    }),
  setActiveWorkspace: (next) =>
    set((state) => {
      const current = selectActiveWorkspace(state);
      const active = resolve(next, current);
      return { activeRoot: active?.root ?? null };
    }),
}));
