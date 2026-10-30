const KEY = "tauri-notes.disabled-plugins.v1";

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
      value.filter((item): item is string => typeof item === "string"),
    );
  } catch {
    return new Set();
  }
}

export function isPluginDisabled(id: string): boolean {
  return readDisabledPlugins().has(id);
}

export function setPluginDisabled(id: string, disabled: boolean): void {
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
