import { command } from "./tauri/client";
import type { LibraryId } from "../types";

export type ReferenceTarget = {
  blockId: string;
  documentId: string;
  documentTitle: string;
  blockType: string;
  preview: string;
};

export type ReferencePreview = {
  documentTitle: string;
  blockId: string;
  plainText: string;
  contentJson: string;
  blockType: string;
  documentId: string;
};

export const referenceClient = {
  listTargets(libraryId: LibraryId): Promise<ReferenceTarget[]> {
    return command("list_reference_targets", { libraryId });
  },

  preview(
    libraryId: LibraryId,
    referenceId: string,
  ): Promise<ReferencePreview> {
    return command("load_reference_preview", {
      libraryId,
      referenceId,
    });
  },

  relink(
    libraryId: LibraryId,
    referenceId: string,
    targetDocumentId: string,
    targetBlockId: string,
  ): Promise<void> {
    return command("relink_reference", {
      libraryId,
      referenceId,
      targetDocumentId,
      targetBlockId,
    });
  },
};
