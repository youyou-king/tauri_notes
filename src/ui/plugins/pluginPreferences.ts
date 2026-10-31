const KEY = "tauri-notes.disabled-plugins.v1";

/**
 * The plugin manager is a shell capability. If it could be disabled through
 * stale storage there would be no UI left to re-enable it.
 */
export const RESERVED_PLUGIN_IDS = new Set(["manager"]);

export function readDisabledPlugins(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      return new Set();
    }
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) {
      return new Set();
    }
    return new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" &&
          !RESERVED_PLUGIN_IDS.has(item),
      ),
    );
  } catch {
    return new Set();
  }
}

export function isPluginDisabled(id: string): boolean {
  return !RESERVED_PLUGIN_IDS.has(id) && readDisabledPlugins().has(id);
}

export function setPluginDisabled(id: string, disabled: boolean): void {
  if (RESERVED_PLUGIN_IDS.has(id)) {
    return;
  }
  const current = readDisabledPlugins();
  if (disabled) {
    current.add(id);
  } else {
    current.delete(id);
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...current]));
  } catch {
    // Preferences are optional.
  }
}
