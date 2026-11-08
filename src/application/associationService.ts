import { command } from "../infrastructure/tauri/client";

/**
 * OS file-association boundary. Shell settings use this port; command menu
 * items do not own platform-specific association behavior.
 */
export const associationService = {
  status(): Promise<boolean> {
    return command("file_association_status");
  },

  register(): Promise<void> {
    return command("register_note_association");
  },

  unregister(): Promise<void> {
    return command("unregister_note_association");
  },
};