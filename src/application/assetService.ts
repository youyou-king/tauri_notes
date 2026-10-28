import { command } from "../infrastructure/tauri/client";

export const assetService = {
  saveImage(input: {
    workspace: string;
    documentId: string;
    fileName: string;
    bytes: number[];
    noteFile: boolean;
  }): Promise<string> {
    return command(
      input.noteFile ? "save_note_image_asset" : "save_image_asset",
      {
        workspace: input.workspace,
        documentId: input.documentId,
        fileName: input.fileName,
        bytes: input.bytes,
      },
    );
  },
};
