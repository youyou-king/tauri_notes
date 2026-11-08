import { command } from "../infrastructure/tauri/client";
import type { LibraryId } from "../types";
import type { StoredBlock } from "../domain/importedDocument";

/**
 * 已导入文档服务：只接收 LibraryId；后端从 registry 解析当前路径。
 */
export const documentService = {
  list(
    libraryId: LibraryId,
  ): Promise<Array<{ id: string; title: string }>> {
    return command("list_imported_documents", { libraryId });
  },

  loadBlocks(
    libraryId: LibraryId,
    documentId: string,
  ): Promise<StoredBlock[]> {
    return command("load_document_blocks", { libraryId, documentId });
  },

  loadBlocksPreview(
    libraryId: LibraryId,
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
    return command("load_blocks_preview", { libraryId, blockIds });
  },

  create(
    libraryId: LibraryId,
    mapId: string,
    title: string,
  ): Promise<{ id: string; title: string }> {
    return command("create_imported_document", {
      libraryId,
      mapId,
      title,
    });
  },

  getTitle(libraryId: LibraryId, documentId: string): Promise<string> {
    return command("get_imported_document_title", {
      libraryId,
      documentId,
    });
  },

  rename(
    libraryId: LibraryId,
    documentId: string,
    title: string,
  ): Promise<void> {
    return command("rename_imported_document", {
      libraryId,
      documentId,
      title,
    });
  },

  delete(libraryId: LibraryId, documentId: string): Promise<void> {
    return command("delete_imported_document", {
      libraryId,
      documentId,
    });
  },

  listDeleted(
    libraryId: LibraryId,
  ): Promise<Array<{ id: string; title: string }>> {
    return command("list_deleted_documents", { libraryId });
  },

  restore(libraryId: LibraryId, documentId: string): Promise<void> {
    return command("restore_imported_document", {
      libraryId,
      documentId,
    });
  },
};