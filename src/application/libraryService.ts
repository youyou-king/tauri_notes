import { command } from "../infrastructure/tauri/client";
import type { WorkspaceView } from "../types";

export const libraryService = {
  register(path: string): Promise<WorkspaceView> {
    return command("register_library", { path });
  },

  open(id: string): Promise<WorkspaceView> {
    return command("open_library", { id });
  },

  rename(id: string, title: string): Promise<WorkspaceView> {
    return command("rename_library", { id, title });
  },

  relocate(id: string, path: string): Promise<WorkspaceView> {
    return command("relocate_library", { id, path });
  },

  forget(id: string): Promise<boolean> {
    return command("forget_library", { id });
  },
};