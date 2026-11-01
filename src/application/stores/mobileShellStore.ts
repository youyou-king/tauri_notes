import { create } from "zustand";

export type MobileTab = "map" | "library" | "document";

type MobileShellState = {
  workspaceRoot: string | null;
  tab: MobileTab;
  documentId: string | null;
  editing: boolean;
  hydrate: (workspaceRoot: string | null) => void;
  setTab: (tab: MobileTab) => void;
  openDocument: (documentId: string) => void;
  setEditing: (editing: boolean) => void;
  reset: () => void;
};

const STORAGE_KEY = "tauri-notes.mobile-shell.v1";

type StoredState = {
  version?: number;
  workspaceRoot?: unknown;
  tab?: unknown;
  documentId?: unknown;
};

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(state: MobileShellState): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        workspaceRoot: state.workspaceRoot,
        tab: state.tab,
        documentId: state.documentId,
      }),
    );
  } catch {
    // localStorage can be unavailable in hardened WebViews.
  }
}

function isTab(value: unknown): value is MobileTab {
  return value === "map" || value === "library" || value === "document";
}

export const useMobileShellStore = create<MobileShellState>((set, get) => ({
  workspaceRoot: null,
  tab: "map",
  documentId: null,
  editing: false,
  hydrate: (workspaceRoot) => {
    if (!workspaceRoot) {
      set({ workspaceRoot: null, tab: "map", documentId: null, editing: false });
      return;
    }
    if (get().workspaceRoot === workspaceRoot) {
      return;
    }
    const stored = readStored();
    if (stored?.workspaceRoot === workspaceRoot) {
      set({
        workspaceRoot,
        tab: isTab(stored.tab) ? stored.tab : "map",
        documentId:
          typeof stored.documentId === "string" ? stored.documentId : null,
        editing: false,
      });
      return;
    }
    set({ workspaceRoot, tab: "map", documentId: null, editing: false });
  },
  setTab: (tab) => {
    set({ tab });
    writeStored(get());
  },
  openDocument: (documentId) => {
    set({ documentId, editing: false, tab: "document" });
    writeStored(get());
  },
  setEditing: (editing) => {
    set({ editing });
  },
  reset: () => {
    set({ tab: "map", documentId: null, editing: false });
    writeStored(get());
  },
}));