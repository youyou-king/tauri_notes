import {
  runMigrations,
  type MigrationStep,
} from "./migrationLedger";

export const SESSION_KEY = "tauri-notes.session.v1";
export const SESSION_VERSION = 2;
const TITLE_PREFIX = "tauri-notes.workspace-title:";

type StoredSession = {
  version?: unknown;
  roots?: unknown;
  active?: unknown;
  activeRoot?: unknown;
  activeMapId?: unknown;
  selectedNodeId?: unknown;
};

const SESSION_MIGRATIONS: MigrationStep<StoredSession>[] = [
  {
    version: 2,
    migrate: (record) => ({
      ...record,
      activeRoot:
        record.activeRoot ??
        (typeof record.active === "string" ? record.active : null),
      activeMapId:
        typeof record.activeMapId === "string" ? record.activeMapId : null,
      selectedNodeId:
        typeof record.selectedNodeId === "string"
          ? record.selectedNodeId
          : null,
    }),
  },
];

function migrateSession(record: StoredSession): StoredSession {
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? record.version
      : 1;
  if (version > SESSION_VERSION) {
    return record;
  }
  const initial: StoredSession = { ...record, version };
  return runMigrations(
    initial,
    version,
    SESSION_VERSION,
    SESSION_MIGRATIONS,
  );
}

export type SessionSelection = {
  activeMapId: string | null;
  selectedNodeId: string | null;
};

export type SessionSnapshot = SessionSelection & {
  version: typeof SESSION_VERSION;
  roots: string[];
  activeRoot: string | null;
};

export function readSession(): SessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredSession;
    if (
      typeof parsed.version === "number" &&
      parsed.version > SESSION_VERSION
    ) {
      return null;
    }
    const migrated = migrateSession(parsed);
    return {
      version: SESSION_VERSION,
      roots: Array.isArray(migrated.roots)
        ? migrated.roots.filter(
            (root): root is string => typeof root === "string",
          )
        : [],
      activeRoot:
        typeof migrated.activeRoot === "string"
          ? migrated.activeRoot
          : null,
      activeMapId:
        typeof migrated.activeMapId === "string"
          ? migrated.activeMapId
          : null,
      selectedNodeId:
        typeof migrated.selectedNodeId === "string"
          ? migrated.selectedNodeId
          : null,
    };
  } catch {
    return null;
  }
}

export function writeSession(
  roots: string[],
  activeRoot: string | null,
  selection: SessionSelection = {
    activeMapId: null,
    selectedNodeId: null,
  },
): void {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      version: SESSION_VERSION,
      roots,
      activeRoot,
      activeMapId: selection.activeMapId,
      selectedNodeId: selection.selectedNodeId,
    }),
  );
}

export function readWorkspaceTitle(root: string): string | null {
  return window.localStorage.getItem(`${TITLE_PREFIX}${root}`);
}

export function writeWorkspaceTitle(root: string, title: string): void {
  window.localStorage.setItem(`${TITLE_PREFIX}${root}`, title);
}

export function clearWorkspaceTitle(root: string): void {
  window.localStorage.removeItem(`${TITLE_PREFIX}${root}`);
}
