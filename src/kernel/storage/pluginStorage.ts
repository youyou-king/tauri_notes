export type PluginStoragePort = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
  getJSON: <T>(key: string, fallback: T) => T;
  setJSON: (key: string, value: unknown) => void;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PLUGIN_PREFIX = "tauri-notes.plugin.";
const LEGACY_PREFIX = "tauri-notes.";

/**
 * Plugin-local key/value storage. Plugins must not reach into
 * `window.localStorage` directly; this port owns the namespace and migrates
 * legacy unprefixed keys on first access.
 */
export function createPluginStorage(
  pluginId: string,
  backend: StorageLike = window.localStorage,
): PluginStoragePort {
  const prefix = `${PLUGIN_PREFIX}${pluginId}.`;
  const scoped = (key: string) => `${prefix}${key}`;
  const legacy = (key: string) => `${LEGACY_PREFIX}${key}`;

  return {
    get: (key) => {
      const current = backend.getItem(scoped(key));
      if (current !== null) {
        return current;
      }
      const previous = backend.getItem(legacy(key));
      if (previous !== null) {
        backend.setItem(scoped(key), previous);
        backend.removeItem(legacy(key));
      }
      return previous;
    },
    set: (key, value) => {
      backend.setItem(scoped(key), value);
      backend.removeItem(legacy(key));
    },
    remove: (key) => {
      backend.removeItem(scoped(key));
      backend.removeItem(legacy(key));
    },
    getJSON: <T>(key: string, fallback: T): T => {
      try {
        const raw = backend.getItem(scoped(key)) ?? backend.getItem(legacy(key));
        if (raw === null) {
          return fallback;
        }
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    setJSON: (key, value) => {
      backend.setItem(scoped(key), JSON.stringify(value));
      backend.removeItem(legacy(key));
    },
  };
}
