import { command } from "./tauri/client";

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
  listTargets(workspace: string): Promise<ReferenceTarget[]> {
    return command("list_reference_targets", { workspace });
  },

  preview(
    workspace: string,
    referenceId: string,
  ): Promise<ReferencePreview> {
    return command("load_reference_preview", {
      workspace,
      referenceId,
    });
  },

  relink(
    workspace: string,
    referenceId: string,
    targetDocumentId: string,
    targetBlockId: string,
  ): Promise<void> {
    return command("relink_reference", {
      workspace,
      referenceId,
      targetDocumentId,
      targetBlockId,
    });
  },
};
