import { documentService } from "../../application/documentService";
import type { DocumentActionsPort } from "../../application/ports/documentActionsPort";

function createDocumentActions(): DocumentActionsPort {
  return {
    rename(libraryId, documentId, title) {
      return documentService.rename(libraryId, documentId, title);
    },
    moveToTrash(libraryId, documentId) {
      return documentService.delete(libraryId, documentId);
    },
  };
}

export function createDesktopDocumentActions(): DocumentActionsPort {
  return createDocumentActions();
}

export function createMobileDocumentActions(): DocumentActionsPort {
  return createDocumentActions();
}