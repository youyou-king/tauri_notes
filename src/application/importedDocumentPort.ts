import type {
  ImportedDocumentSummary,
  SaveBlock,
  StoredBlock,
} from "../domain/importedDocument";

export type ImportedDocumentRepository = {
  list(): Promise<ImportedDocumentSummary[]>;
  loadBlocks(documentId: string): Promise<StoredBlock[]>;
  saveBlocks(
    documentId: string,
    blocks: SaveBlock[],
    deleted: string[],
  ): Promise<void>;
};
