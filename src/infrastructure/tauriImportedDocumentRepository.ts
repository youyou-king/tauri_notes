import { invoke } from "@tauri-apps/api/core";
import type { ImportedDocumentRepository } from "../application/importedDocumentPort";
import type {
  ImportedDocumentSummary,
  SaveBlock,
  StoredBlock,
} from "../domain/importedDocument";

export class TauriImportedDocumentRepository
  implements ImportedDocumentRepository
{
  constructor(private readonly workspaceRoot: string) {}

  list(): Promise<ImportedDocumentSummary[]> {
    return invoke("list_imported_documents", {
      workspace: this.workspaceRoot,
    });
  }

  loadBlocks(documentId: string): Promise<StoredBlock[]> {
    return invoke("load_document_blocks", {
      workspace: this.workspaceRoot,
      documentId,
    });
  }

  saveBlocks(
    documentId: string,
    blocks: SaveBlock[],
    deleted: string[],
  ): Promise<void> {
    return invoke("save_imported_blocks", {
      workspace: this.workspaceRoot,
      documentId,
      blocks,
      deleted,
    });
  }
}
