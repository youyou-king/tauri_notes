import { Suspense, type ComponentType, type PointerEvent } from "react";
import { PanelContext, type PanelContextValue } from "../panels/PanelContext";
import { MobileDocumentView } from "./MobileDocumentView";

type DocumentViewComponent = ComponentType<{
  workspaceRoot: string;
  documentId?: string;
  panelId?: string;
}>;

export function MobileDocumentPane({
  workspaceRoot,
  documentId,
  editing,
  panelContext,
  DocumentView,
  swipeHandlers,
  onSave,
  onDone,
  onEdit,
}: {
  workspaceRoot: string;
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
  onSave: () => void;
  onDone: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="mobile-document-shell" {...swipeHandlers}>
      <div className="mobile-document-actions">
        {editing ? (
          <>
            <button type="button" onClick={onSave}>
              保存
            </button>
            <button type="button" onClick={onDone}>
              完成
            </button>
          </>
        ) : (
          <button type="button" onClick={onEdit}>
            编辑
          </button>
        )}
      </div>
      {editing && DocumentView ? (
        <PanelContext.Provider value={panelContext}>
          <Suspense fallback={<div className="panel-loading">加载编辑器…</div>}>
            <DocumentView
              workspaceRoot={workspaceRoot}
              documentId={documentId}
            />
          </Suspense>
        </PanelContext.Provider>
      ) : (
        <MobileDocumentView
          workspaceRoot={workspaceRoot}
          documentId={documentId}
        />
      )}
    </div>
  );
}