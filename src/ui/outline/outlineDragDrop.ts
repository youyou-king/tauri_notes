import {
  crossPanelBus,
  PANEL_DRAG_MIME,
} from "../../kernel/event";
import type { OutlineDragDrop } from "./OutlineTreeNode";

export const NOTE_DOCUMENT_MIME = "application/x-note-document";

export type OutlineDocumentDrop = {
  root: string;
  documentId: string;
};

export function acceptsOutlineDocumentDrop(
  types: readonly string[],
): boolean {
  return (
    types.includes(NOTE_DOCUMENT_MIME) || types.includes(PANEL_DRAG_MIME)
  );
}

export function readNoteDocumentDrop(
  dataTransfer: Pick<DataTransfer, "getData">,
): OutlineDocumentDrop | null {
  const raw = dataTransfer.getData(NOTE_DOCUMENT_MIME);
  if (!raw) {
    return null;
  }
  try {
    const payload = JSON.parse(raw) as {
      root?: unknown;
      documentId?: unknown;
    };
    return typeof payload.documentId === "string"
      ? {
          root:
            typeof payload.root === "string" ? payload.root : "",
          documentId: payload.documentId,
        }
      : null;
  } catch {
    return null;
  }
}

/**
 * Desktop-only adapter between the shared outline row and the panel
 * drag bus. Mobile imports the row without importing this module.
 */
export function createOutlineDragDrop(
  nodeId: string,
  onDropDocument: (
    nodeId: string,
    sourceRoot: string,
    documentId: string,
  ) => void,
): OutlineDragDrop {
  return {
    accepts: acceptsOutlineDocumentDrop,
    onDrop: (event) => {
      const panelPayload = crossPanelBus.read(event.dataTransfer);
      if (panelPayload?.kind === "document") {
        onDropDocument(
          nodeId,
          panelPayload.root,
          panelPayload.documentId,
        );
        crossPanelBus.endDrag();
        return;
      }
      const payload = readNoteDocumentDrop(event.dataTransfer);
      if (payload) {
        onDropDocument(nodeId, payload.root, payload.documentId);
      }
    },
  };
}