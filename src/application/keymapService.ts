import type { KeymapDocument, KeymapRecord } from "../kernel/action";
import { command } from "../infrastructure/tauri/client";

const EMPTY_KEYMAP: KeymapDocument = {
  version: 2,
  bindings: [],
};

function normalizeRecord(record: KeymapRecord): KeymapRecord | null {
  if (!record || typeof record.action !== "string") {
    return null;
  }
  if (
    record.platform !== "desktop" &&
    record.platform !== "mac" &&
    record.platform !== "mobile"
  ) {
    return null;
  }
  return record;
}

export const keymapService = {
  async load(): Promise<KeymapDocument> {
    try {
      const document = await command<KeymapDocument>("load_keymap");
      const bindings = Array.isArray(document?.bindings)
        ? document.bindings
            .map(normalizeRecord)
            .filter((record): record is KeymapRecord => record !== null)
        : [];
      const defaults = Array.isArray(document?.defaults)
        ? document.defaults
            .map(normalizeRecord)
            .filter((record): record is KeymapRecord => record !== null)
        : [];
      return {
        version:
          typeof document?.version === "number" ? document.version : 2,
        bindings,
        defaults,
      };
    } catch {
      // A missing/malformed keymap must not block startup; defaults still work.
      return EMPTY_KEYMAP;
    }
  },

  save(document: KeymapDocument): Promise<void> {
    return command("save_keymap", { keymap: document });
  },

  export(path: string, document: KeymapDocument): Promise<void> {
    return command("export_keymap", { path, keymap: document });
  },

  import(path: string): Promise<KeymapDocument> {
    return command<KeymapDocument>("import_keymap", { path });
  },
};