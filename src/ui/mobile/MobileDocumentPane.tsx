import { Suspense, type ComponentType, type PointerEvent } from "react";
import { PanelContext, type PanelContextValue } from "../panels/PanelContext";
import { MobileDocumentView } from "./MobileDocumentView";
import type { LibraryId } from "../../types";

type DocumentViewComponent = ComponentType<{
  workspaceRoot: string;
  libraryId: LibraryId;
  documentId?: string;
  panelId?: string;
}>;

export function MobileDocumentPane({
  workspaceRoot,
  libraryId,
  documentId,
  editing,
  panelContext,
  DocumentView,
  swipeHandlers,
}: {
  workspaceRoot: string;
  libraryId: LibraryId;
  documentId: string;
  editing: boolean;
  panelContext: PanelContextValue;
  DocumentView: DocumentViewComponent | null;
  swipeHandlers: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
  };
}) {
  return (
    <div
      className={`mobile-document-shell${editing ? " is-editing" : ""}`}
      {...swipeHandlers}
    >
      {editing && DocumentView ? (
        <PanelContext.Provider value={panelContext}>
          <Suspense fallback={<div className="panel-loading">加载编辑器…</div>}>
            <DocumentView
              workspaceRoot={workspaceRoot}
              libraryId={libraryId}
              documentId={documentId}
            />
          </Suspense>
        </PanelContext.Provider>
      ) : (
        <MobileDocumentView
          libraryId={libraryId}
          documentId={documentId}
        />
      )}
    </div>
  );
}