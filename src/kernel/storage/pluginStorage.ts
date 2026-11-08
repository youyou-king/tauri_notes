export type PluginStoragePort = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
  getJSON: <T>(key: string, fallback: T) => T;
  setJSON: (key: string, value: unknown) => void;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PLUGIN_PREFIX = "tauri-notes.plugin.";

/**
 * Plugin-local key/value storage. Plugins must not reach into
 * `window.localStorage` directly; this port owns the namespace.
 */
export function createPluginStorage(
  pluginId: string,
  backend: StorageLike = window.localStorage,
): PluginStoragePort {
  const prefix = `${PLUGIN_PREFIX}${pluginId}.`;
  const scoped = (key: string) => `${prefix}${key}`;

  return {
    get: (key) => backend.getItem(scoped(key)),
    set: (key, value) => backend.setItem(scoped(key), value),
    remove: (key) => backend.removeItem(scoped(key)),
    getJSON: <T>(key: string, fallback: T): T => {
      try {
        const raw = backend.getItem(scoped(key));
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
    },
  };
}