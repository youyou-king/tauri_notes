import type { LibraryId, LibraryPath } from "../types";

export const SESSION_KEY = "tauri-notes.session";
export const SESSION_VERSION = 4;

type StoredSession = {
  version?: unknown;
  libraries?: unknown;
  activeId?: unknown;
  missing?: unknown;
  activeMapId?: unknown;
  selectedNodeId?: unknown;
  activePanelId?: unknown;
};

export type SessionLibrary = {
  id: LibraryId;
  path: LibraryPath;
};

export type SessionMissingLibrary = {
  id: LibraryId | null;
  path: LibraryPath;
};

export type SessionSelection = {
  activeMapId: string | null;
  selectedNodeId: string | null;
  activePanelId?: string | null;
};

export type SessionSnapshot = SessionSelection & {
  version: typeof SESSION_VERSION;
  libraries: SessionLibrary[];
  activeId: string | null;
  missing: SessionMissingLibrary[];
  activePanelId: string | null;
};

function sessionLibraries(value: unknown): SessionLibrary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is SessionLibrary =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as SessionLibrary).id === "string" &&
      typeof (item as SessionLibrary).path === "string",
  );
}

function sessionMissing(value: unknown): SessionMissingLibrary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is SessionMissingLibrary =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as SessionMissingLibrary).path === "string" &&
      (typeof (item as SessionMissingLibrary).id === "string" ||
        (item as SessionMissingLibrary).id === null),
  );
}

/**
 * 会话只接受当前版本；版本不匹配视为无效会话并冷启动。
 * 不保留迁移层。
 */
export function readSession(): SessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.version !== SESSION_VERSION) {
      return null;
    }
    return {
      version: SESSION_VERSION,
      libraries: sessionLibraries(parsed.libraries),
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
      missing: sessionMissing(parsed.missing),
      activeMapId:
        typeof parsed.activeMapId === "string" ? parsed.activeMapId : null,
      selectedNodeId:
        typeof parsed.selectedNodeId === "string"
          ? parsed.selectedNodeId
          : null,
      activePanelId:
        typeof parsed.activePanelId === "string"
          ? parsed.activePanelId
          : null,
    };
  } catch {
    return null;
  }
}

export function writeSession(
  libraries: SessionLibrary[],
  activeId: string | null,
  selection: SessionSelection = {
    activeMapId: null,
    selectedNodeId: null,
  },
  missing: SessionMissingLibrary[] = [],
): void {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      version: SESSION_VERSION,
      libraries,
      activeId,
      missing,
      activeMapId: selection.activeMapId,
      selectedNodeId: selection.selectedNodeId,
      activePanelId: selection.activePanelId ?? null,
    }),
  );
}