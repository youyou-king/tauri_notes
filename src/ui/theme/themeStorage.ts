import { runMigrations } from "../../application/migrationLedger";
import type { ThemeSelection } from "./themeSchema";

export const THEME_STORAGE_KEY = "tauri-notes.theme";
export const THEME_STORAGE_VERSION = 2;

type StoredTheme = {
  version: number;
  selection: ThemeSelection;
};

function isThemeSelection(value: unknown): value is ThemeSelection {
  return (
    value === "light" ||
    value === "system" ||
    value === "dark" ||
    (typeof value === "string" && value.startsWith("custom:"))
  );
}

function parseThemeRecord(raw: string): StoredTheme | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isThemeSelection(parsed)) {
      return { version: 1, selection: parsed };
    }
    if (parsed && typeof parsed === "object") {
      const record = parsed as Partial<StoredTheme>;
      if (isThemeSelection(record.selection)) {
        return {
          version:
            typeof record.version === "number" ? record.version : 1,
          selection: record.selection,
        };
      }
    }
  } catch {
    // Legacy versions stored a bare string such as "dark".
    if (isThemeSelection(raw)) {
      return { version: 1, selection: raw };
    }
  }
  return null;
}

const THEME_MIGRATIONS = [
  {
    version: 2,
    migrate: (record: StoredTheme): StoredTheme => ({
      ...record,
      version: 2,
    }),
  },
];

export function readThemeSelection(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): ThemeSelection {
  const raw = storage.getItem(THEME_STORAGE_KEY);
  if (!raw) {
    return "dark";
  }
  const record = parseThemeRecord(raw);
  if (!record || record.version > THEME_STORAGE_VERSION) {
    return "dark";
  }
  return runMigrations(
    record,
    record.version,
    THEME_STORAGE_VERSION,
    THEME_MIGRATIONS,
  ).selection;
}

export function writeThemeSelection(
  selection: ThemeSelection,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  const stored: StoredTheme = {
    version: THEME_STORAGE_VERSION,
    selection,
  };
  storage.setItem(THEME_STORAGE_KEY, JSON.stringify(stored));
}