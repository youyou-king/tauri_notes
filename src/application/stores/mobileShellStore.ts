import { create } from "zustand";

export type MobileTab = "map" | "library" | "document";

export type MobileLocation = {
  tab: MobileTab;
  documentId: string | null;
};

type MobileShellState = {
  workspaceRoot: string | null;
  tab: MobileTab;
  documentId: string | null;
  editing: boolean;
  history: MobileLocation[];
  hydrate: (workspaceRoot: string | null) => void;
  setTab: (tab: MobileTab) => void;
  openDocument: (documentId: string) => void;
  back: () => boolean;
  setEditing: (editing: boolean) => void;
  reset: () => void;
};

const STORAGE_KEY = "tauri-notes.mobile-shell.v1";
const MAX_HISTORY = 20;

type StoredState = {
  version?: number;
  workspaceRoot?: unknown;
  tab?: unknown;
  documentId?: unknown;
  history?: unknown;
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
        version: 2,
        workspaceRoot: state.workspaceRoot,
        tab: state.tab,
        documentId: state.documentId,
        history: state.history,
      }),
    );
  } catch {
    // localStorage can be unavailable in hardened WebViews.
  }
}

function isTab(value: unknown): value is MobileTab {
  return value === "map" || value === "library" || value === "document";
}

function currentLocation(state: MobileShellState): MobileLocation {
  return { tab: state.tab, documentId: state.documentId };
}

function pushHistory(state: MobileShellState): MobileLocation[] {
  const current = currentLocation(state);
  const previous = state.history[state.history.length - 1];
  if (
    previous?.tab === current.tab &&
    previous.documentId === current.documentId
  ) {
    return state.history;
  }
  return [...state.history, current].slice(-MAX_HISTORY);
}

function readHistory(value: unknown): MobileLocation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item): item is MobileLocation =>
        Boolean(item) &&
        typeof item === "object" &&
        isTab((item as MobileLocation).tab) &&
        (typeof (item as MobileLocation).documentId === "string" ||
          (item as MobileLocation).documentId === null),
    )
    .slice(-MAX_HISTORY);
}

export const useMobileShellStore = create<MobileShellState>((set, get) => ({
  workspaceRoot: null,
  tab: "map",
  documentId: null,
  editing: false,
  history: [],
  hydrate: (workspaceRoot) => {
    if (!workspaceRoot) {
      set({
        workspaceRoot: null,
        tab: "map",
        documentId: null,
        editing: false,
        history: [],
      });
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
        history: readHistory(stored.history),
      });
      return;
    }
    set({
      workspaceRoot,
      tab: "map",
      documentId: null,
      editing: false,
      history: [],
    });
  },
  setTab: (tab) => {
    if (get().tab === tab) {
      return;
    }
    set({ history: pushHistory(get()), tab });
    writeStored(get());
  },
  openDocument: (documentId) => {
    if (get().tab === "document" && get().documentId === documentId) {
      return;
    }
    set({
      history: pushHistory(get()),
      documentId,
      editing: false,
      tab: "document",
    });
    writeStored(get());
  },
  back: () => {
    const history = get().history;
    const previous = history[history.length - 1];
    if (!previous) {
      return false;
    }
    set({
      history: history.slice(0, -1),
      tab: previous.tab,
      documentId: previous.documentId,
      editing: false,
    });
    writeStored(get());
    return true;
  },
  setEditing: (editing) => {
    set({ editing });
  },
  reset: () => {
    set({ tab: "map", documentId: null, editing: false, history: [] });
    writeStored(get());
  },
}));