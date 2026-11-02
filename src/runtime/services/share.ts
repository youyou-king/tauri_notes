import { invoke } from "@tauri-apps/api/core";
import type { SharePort } from "../../application/ports/sharePort";

export function createDesktopShare(): SharePort {
  return {
    async shareLibrary() {
      return false;
    },
  };
}

export function createMobileShare(): SharePort {
  return {
    async shareLibrary(path) {
      await invoke("share_managed_library", { path });
      return true;
    },
  };
}