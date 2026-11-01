import { documentService } from "../../application/documentService";
import type { DocumentActionsPort } from "../../application/ports/documentActionsPort";

function createDocumentActions(): DocumentActionsPort {
  return {
    rename(workspaceRoot, documentId, title) {
      return documentService.rename(workspaceRoot, documentId, title);
    },
    moveToTrash(workspaceRoot, documentId) {
      return documentService.delete(workspaceRoot, documentId);
    },
  };
}

export function createDesktopDocumentActions(): DocumentActionsPort {
  return createDocumentActions();
}

export function createMobileDocumentActions(): DocumentActionsPort {
  return createDocumentActions();
}