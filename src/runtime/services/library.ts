import { appDataDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { LibraryPort } from "../../application/ports/libraryPort";

async function defaultNotePath(): Promise<string> {
  try {
    const lastDirectory = window.localStorage.getItem(
      "tauri-notes.last-note-directory",
    );
    if (lastDirectory) {
      return join(lastDirectory, "未命名.note");
    }
  } catch {
    // localStorage can be unavailable in hardened WebViews.
  }
  return join(await appDataDir(), "knowledge", "未命名.note");
}

function createPathLibrary(): LibraryPort {
  return {
    async pickExisting() {
      const picked = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "Notes 知识库", extensions: ["note"] }],
        title: "打开 .note 知识库",
      });
      return typeof picked === "string" ? picked : null;
    },

    async pickNew() {
      const picked = await save({
        title: "新建知识库",
        defaultPath: await defaultNotePath(),
        filters: [{ name: "Notes 知识库", extensions: ["note"] }],
      });
      return typeof picked === "string" ? picked : null;
    },
  };
}

export function createDesktopLibrary(): LibraryPort {
  return createPathLibrary();
}

/**
 * Phase 2 keeps the same path picker on mobile because the Android/iOS target
 * is not initialized yet. The managed-library adapter will replace this
 * implementation without changing LibraryPort.
 */
export function createMobileLibrary(): LibraryPort {
  return createPathLibrary();
}