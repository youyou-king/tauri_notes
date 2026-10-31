import { command } from "../infrastructure/tauri/client";
import type { StoredBlock } from "../domain/importedDocument";

export const documentService = {
  list(
    workspace: string,
  ): Promise<Array<{ id: string; title: string }>> {
    return command("list_imported_documents", { workspace });
  },

  loadBlocks(
    workspace: string,
    documentId: string,
  ): Promise<StoredBlock[]> {
    return command("load_document_blocks", { workspace, documentId });
  },

  loadBlocksPreview(
    workspace: string,
    blockIds: string[],
  ): Promise<
    Array<{
      blockId: string;
      documentId: string;
      documentTitle: string;
      blockType: string;
      plainText: string;
      contentJson: string;
    }>
  > {
    return command("load_blocks_preview", { workspace, blockIds });
  },

  create(
    workspace: string,
    mapId: string,
    title: string,
  ): Promise<{ id: string; title: string }> {
    return command("create_imported_document", {
      workspace,
      mapId,
      title,
    });
  },

  getTitle(workspace: string, documentId: string): Promise<string> {
    return command("get_imported_document_title", {
      workspace,
      documentId,
    });
  },

  rename(
    workspace: string,
    documentId: string,
    title: string,
  ): Promise<void> {
    return command("rename_imported_document", {
      workspace,
      documentId,
      title,
    });
  },

  delete(workspace: string, documentId: string): Promise<void> {
    return command("delete_imported_document", {
      workspace,
      documentId,
    });
  },

  listDeleted(
    workspace: string,
  ): Promise<Array<{ id: string; title: string }>> {
    return command("list_deleted_documents", { workspace });
  },

  restore(workspace: string, documentId: string): Promise<void> {
    return command("restore_imported_document", {
      workspace,
      documentId,
    });
  },
};
