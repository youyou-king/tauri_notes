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

export function readThemeSelection(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): ThemeSelection {
  const raw = storage.getItem(THEME_STORAGE_KEY);
  if (!raw) {
    return "dark";
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isThemeSelection(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      const record = parsed as Partial<StoredTheme>;
      if (
        typeof record.version === "number" &&
        record.version > THEME_STORAGE_VERSION
      ) {
        return "dark";
      }
      if (isThemeSelection(record.selection)) {
        return record.selection;
      }
    }
  } catch {
    // Legacy versions stored a bare string such as "dark".
    if (isThemeSelection(raw)) {
      return raw;
    }
  }
  return "dark";
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