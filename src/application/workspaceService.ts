import { command } from "../infrastructure/tauri/client";
import type { WorkspaceView } from "../types";

export type DatabaseTreeNode = {
  mapId: string;
  documentId: string;
  parentId: string | null;
  title: string;
  orderKey: string;
};

export const workspaceService = {
  open(path: string): Promise<WorkspaceView> {
    return command(
      /\.note$/i.test(path) ? "open_note_workspace" : "open_workspace",
      { path },
    );
  },

  createNoteFile(path: string, title: string): Promise<WorkspaceView> {
    return command("create_note_file", { path, title });
  },

  listDocuments(
    workspace: string,
  ): Promise<Array<{ id: string; title: string }>> {
    return command("list_imported_documents", { workspace });
  },

  loadDocumentTree(workspace: string): Promise<DatabaseTreeNode[]> {
    return command("load_document_tree", { workspace });
  },

  verifyDatabase(workspace: string): Promise<void> {
    return command("verify_database", { workspace });
  },

  backup(workspace: string, noteFile: boolean): Promise<string> {
    return command(
      noteFile ? "save_note_file" : "backup_database",
      noteFile ? { path: workspace } : { workspace },
    );
  },

  takePendingNoteFile(): Promise<string | null> {
    return command("take_pending_note_file");
  },

  helpPath(): Promise<string> {
    return command("help_note_path");
  },

  registerNoteAssociation(): Promise<void> {
    return command("register_note_association");
  },

  unregisterNoteAssociation(): Promise<void> {
    return command("unregister_note_association");
  },
};
