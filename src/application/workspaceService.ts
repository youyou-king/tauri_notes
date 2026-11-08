import { command } from "../infrastructure/tauri/client";
import type { LibraryId, LibraryPath, WorkspaceView } from "../types";

/**
 * 书库生命周期/文件命令边界：
 * - create/backup/close 使用 LibraryPath；
 * - 文档树/文档列表由 documentService 或本模块按 LibraryId 查询。
 */

export type DatabaseTreeNode = {
  mapId: string;
  documentId: string;
  parentId: string | null;
  title: string;
  orderKey: string;
};

export const workspaceService = {
  createNoteFile(path: LibraryPath, title: string): Promise<WorkspaceView> {
    return command("create_note_file", { path, title });
  },

  listDocuments(
    libraryId: LibraryId,
  ): Promise<Array<{ id: string; title: string }>> {
    return command("list_imported_documents", { libraryId });
  },

  loadDocumentTree(libraryId: LibraryId): Promise<DatabaseTreeNode[]> {
    return command("load_document_tree", { libraryId });
  },

  closeDatabase(libraryId: LibraryId): Promise<void> {
    return command("close_workspace_database", { libraryId });
  },

  verifyDatabase(libraryId: LibraryId): Promise<void> {
    return command("verify_database", { libraryId });
  },

  backup(
    libraryId: LibraryId,
    path: LibraryPath,
    noteFile: boolean,
  ): Promise<string> {
    return command(
      noteFile ? "save_note_file" : "backup_database",
      noteFile ? { path } : { libraryId },
    );
  },

  takePendingNoteFile(): Promise<string | null> {
    return command("take_pending_note_file");
  },

  helpPath(): Promise<string> {
    return command("help_note_path");
  },
};
