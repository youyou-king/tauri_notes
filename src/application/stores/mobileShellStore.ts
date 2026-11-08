import { create } from "zustand";
import {
  clampSplitRatio,
  closeSplit,
  DEFAULT_SPLIT_AXIS,
  DEFAULT_SPLIT_RATIOS,
  dockView,
  documentView,
  focusPane,
  focusedView,
  isLayoutValid,
  isView,
  MAP_VIEW,
  normalizeSplitRatios,
  replaceFocused,
  sameView,
  viewForKind,
  type MobileDropPlacement,
  type MobileLayout,
  type MobilePane,
  type MobileSplitAxis,
  type MobileView,
  type MobileViewKind,
} from "./mobileLayout";

export type {
  MobileDropPlacement,
  MobileLayout,
  MobilePane,
  MobileSplitAxis,
  MobileView,
  MobileViewKind,
} from "./mobileLayout";
export { documentView, focusedView, viewForKind };

type MobileShellState = MobileLayout & {
  libraryId: string | null;
  editing: boolean;
  history: MobileView[];
  hydrate: (libraryId: string | null) => void;
  selectView: (kind: MobileViewKind, documentId?: string | null) => void;
  openDocument: (documentId: string) => void;
  dropView: (
    kind: MobileViewKind,
    placement: MobileDropPlacement,
    documentId?: string | null,
  ) => void;
  closeSplit: () => void;
  setSplitRatio: (axis: MobileSplitAxis, ratio: number) => void;
  focusPane: (pane: MobilePane) => void;
  back: () => boolean;
  setEditing: (editing: boolean) => void;
  reset: () => void;
};

const STORAGE_KEY = "tauri-notes.mobile-shell";
const STORAGE_VERSION = 6;
const MAX_HISTORY = 20;

type StoredState = {
  version?: unknown;
  libraryId?: unknown;
  views?: unknown;
  focused?: unknown;
  ratios?: unknown;
  axis?: unknown;
  history?: unknown;
};

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredState;
    return parsed &&
      typeof parsed === "object" &&
      parsed.version === STORAGE_VERSION
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeStored(state: MobileShellState): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        libraryId: state.libraryId,
        views: state.views,
        focused: state.focused,
        ratios: state.ratios,
        axis: state.axis,
        history: state.history,
      }),
    );
  } catch {
    // localStorage can be unavailable in hardened WebViews.
  }
}

function initialLayout(): MobileLayout {
  return {
    views: [MAP_VIEW, null],
    focused: 0,
    ratios: { ...DEFAULT_SPLIT_RATIOS },
    axis: DEFAULT_SPLIT_AXIS,
  };
}

function freshState(libraryId: string | null): Partial<MobileShellState> {
  return {
    libraryId,
    ...initialLayout(),
    editing: false,
    history: [],
  };
}

function pushHistory(
  history: MobileView[],
  current: MobileView,
): MobileView[] {
  const previous = history[history.length - 1];
  if (
    previous &&
    previous.kind === current.kind &&
    previous.documentId === current.documentId
  ) {
    return history;
  }
  return [...history, current].slice(-MAX_HISTORY);
}

function readHistory(value: unknown): MobileView[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isView).slice(-MAX_HISTORY);
}

export const useMobileShellStore = create<MobileShellState>((set, get) => ({
  libraryId: null,
  ...initialLayout(),
  editing: false,
  history: [],
  hydrate: (libraryId) => {
    if (!libraryId) {
      set(freshState(null));
      return;
    }
    if (get().libraryId === libraryId) {
      return;
    }
    const stored = readStored();
    if (
      stored &&
      stored.libraryId === libraryId &&
      isLayoutValid(stored.views)
    ) {
      const focused = stored.focused === 1 ? 1 : 0;
      const views = stored.views;
      set({
        libraryId,
        views,
        focused: views[focused] ? focused : 0,
        ratios: normalizeSplitRatios(stored.ratios),
        axis:
          stored.axis === "row" || stored.axis === "column"
            ? stored.axis
            : DEFAULT_SPLIT_AXIS,
        editing: false,
        history: readHistory(stored.history),
      });
      writeStored(get());
      return;
    }
    set(freshState(libraryId));
  },
  selectView: (kind, documentId) => {
    const state = get();
    const view = viewForKind(state, kind, documentId);
    if (!view) {
      return;
    }
    const current = focusedView(state);
    set({
      ...replaceFocused(state, view),
      editing: false,
      history: pushHistory(state.history, current),
    });
    writeStored(get());
  },
  openDocument: (documentId) => {
    const state = get();
    const view = documentView(documentId);
    if (sameView(focusedView(state), view)) {
      return;
    }
    set({
      ...replaceFocused(state, view),
      editing: false,
      history: pushHistory(state.history, focusedView(state)),
    });
    writeStored(get());
  },
  dropView: (kind, placement, documentId) => {
    const state = get();
    const view = viewForKind(state, kind, documentId);
    if (!view) {
      return;
    }
    set({
      ...dockView(state, view, placement),
      editing: false,
    });
    writeStored(get());
  },
  closeSplit: () => {
    set({ ...closeSplit(get()), editing: false });
    writeStored(get());
  },
  setSplitRatio: (axis, ratio) => {
    if (!get().views[1]) {
      return;
    }
    set({
      ratios: {
        ...get().ratios,
        [axis]: clampSplitRatio(ratio),
      },
    });
    writeStored(get());
  },
  focusPane: (pane) => {
    set(focusPane(get(), pane));
    writeStored(get());
  },
  back: () => {
    const state = get();
    if (state.views[1]) {
      set({ ...closeSplit(state), editing: false });
      writeStored(get());
      return true;
    }
    const history = state.history;
    const previous = history[history.length - 1];
    if (!previous) {
      return false;
    }
    set({
      ...replaceFocused(
        {
          views: [state.views[0], null],
          focused: 0,
          ratios: state.ratios,
          axis: state.axis,
        },
        previous,
      ),
      editing: false,
      history: history.slice(0, -1),
    });
    writeStored(get());
    return true;
  },
  setEditing: (editing) => {
    set({ editing });
  },
  reset: () => {
    set(freshState(get().libraryId));
    writeStored(get());
  },
}));