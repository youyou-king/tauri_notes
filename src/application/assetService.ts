import { command } from "../infrastructure/tauri/client";
import type { LibraryId } from "../types";

export const assetService = {
  saveImage(input: {
    libraryId: LibraryId;
    documentId: string;
    fileName: string;
    bytes: number[];
    noteFile: boolean;
  }): Promise<string> {
    return command(
      input.noteFile ? "save_note_image_asset" : "save_image_asset",
      {
        libraryId: input.libraryId,
        documentId: input.documentId,
        fileName: input.fileName,
        bytes: input.bytes,
      },
    );
  },
};
