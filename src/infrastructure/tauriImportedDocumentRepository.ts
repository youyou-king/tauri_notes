import { invoke } from "@tauri-apps/api/core";
import type { ImportedDocumentRepository } from "../application/importedDocumentPort";
import type {
  ImportedDocumentSummary,
  SaveBlock,
  StoredBlock,
} from "../domain/importedDocument";
import type { LibraryId } from "../types";

export class TauriImportedDocumentRepository
  implements ImportedDocumentRepository
{
  constructor(private readonly libraryId: LibraryId) {}

  list(): Promise<ImportedDocumentSummary[]> {
    return invoke("list_imported_documents", {
      libraryId: this.libraryId,
    });
  }

  loadBlocks(documentId: string): Promise<StoredBlock[]> {
    return invoke("load_document_blocks", {
      libraryId: this.libraryId,
      documentId,
    });
  }

  saveBlocks(
    documentId: string,
    blocks: SaveBlock[],
    deleted: string[],
  ): Promise<void> {
    return invoke("save_imported_blocks", {
      libraryId: this.libraryId,
      documentId,
      blocks,
      deleted,
    });
  }
}