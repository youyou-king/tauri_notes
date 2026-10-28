import { command } from "../infrastructure/tauri/client";

export const documentService = {
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
};
