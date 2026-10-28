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
  activeWorkspace: WorkspaceView | null;
  setWorkspaces: (next: Updater<WorkspaceView[]>) => void;
  setActiveWorkspace: (next: Updater<WorkspaceView | null>) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  setWorkspaces: (next) =>
    set((state) => ({ workspaces: resolve(next, state.workspaces) })),
  setActiveWorkspace: (next) =>
    set((state) => ({
      activeWorkspace: resolve(next, state.activeWorkspace),
    })),
}));
