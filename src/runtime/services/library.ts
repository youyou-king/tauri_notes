import { appDataDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { LibraryPort } from "../../application/ports/libraryPort";
import { managedLibraryService } from "../../application/managedLibraryService";

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
    managed: false,
    async pickExisting() {
      const picked = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "Notes 知识库", extensions: ["note"] }],
        title: "打开 .note 知识库",
      });
      return typeof picked === "string" ? picked : null;
    },

    async exportLibrary(source) {
      const name = source.split(/[\\/]/).pop() ?? "library.note";
      const picked = await save({
        title: "导出知识库",
        defaultPath: name,
        filters: [{ name: "Notes 知识库", extensions: ["note"] }],
      });
      if (typeof picked !== "string") {
        return null;
      }
      return managedLibraryService.export(source, picked);
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
 * Mobile imports external `.note` files into the App-private library before
 * opening them. New-library creation still uses the path picker until the
 * managed create flow lands.
 */
export function createMobileLibrary(): LibraryPort {
  const paths = createPathLibrary();
  return {
    managed: true,
    async pickExisting() {
      const picked = await paths.pickExisting();
      if (!picked) {
        return null;
      }
      const imported = await managedLibraryService.import(picked);
      return imported.path;
    },
    async pickNew(title) {
      return managedLibraryService.newPath(title ?? "未命名");
    },
    exportLibrary: paths.exportLibrary,
  };
}