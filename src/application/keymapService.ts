import type { KeymapDocument, KeymapRecord } from "../kernel/action";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
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
      if (typeof document?.version !== "number") {
        return EMPTY_KEYMAP;
      }
      return {
        version: document.version,
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

  async exportWithDialog(document: KeymapDocument): Promise<boolean> {
    const path = await saveDialog({
      title: "导出快捷键",
      defaultPath: "keymap.toml",
      filters: [{ name: "TOML", extensions: ["toml"] }],
    });
    if (typeof path !== "string") {
      return false;
    }
    await this.export(path, document);
    return true;
  },

  import(path: string): Promise<KeymapDocument> {
    return command<KeymapDocument>("import_keymap", { path });
  },

  async importWithDialog(): Promise<KeymapDocument | null> {
    const path = await open({
      title: "导入快捷键",
      multiple: false,
      filters: [{ name: "TOML", extensions: ["toml"] }],
    });
    if (typeof path !== "string") {
      return null;
    }
    return this.import(path);
  },
};