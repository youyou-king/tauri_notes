import { Suspense, useEffect } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { documentService } from "../../application/documentService";
import { findNode } from "../../domain/tree";
import { getUiRenderer } from "../../kernel/ui";
import { usePanelContext } from "./PanelContext";
import { APP_EVENTS, onAppEvent } from "../../kernel/events";

import type { LibraryId } from "../../types";

export type BlockDocParams = {
  documentId?: string;
  libraryId?: LibraryId;
};

export function BlockDocumentPanel(
  props: IDockviewPanelProps<BlockDocParams>,
) {
  const context = usePanelContext();
  const documentId = props.params.documentId;
  const libraryId: LibraryId | null =
    props.params.libraryId ?? context?.workspace?.id ?? null;
  const documentWorkspace = context?.workspaces.find(
    (item) => item.id === libraryId,
  );
  const workspaceRoot =
    documentWorkspace?.root ?? context?.workspace?.root ?? "";

  useEffect(() => {
    if (!libraryId || !documentId) {
      return;
    }
    const refresh = () => {
      void documentService
        .getTitle(libraryId, documentId)
        .then((title) => props.api.setTitle(title))
        .catch(() => {});
    };
    refresh();
    const unsubscribers = [
      onAppEvent(APP_EVENTS.documentRenamed, refresh),
      onAppEvent(APP_EVENTS.mapsChanged, refresh),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [libraryId, documentId, props.api]);

  useEffect(() => {
    if (!documentWorkspace || !documentId) {
      return;
    }
    const [mapId, nodeId] = documentId.split("/");
    const map = documentWorkspace.maps.find((item) => item.id === mapId);
    const node = map && nodeId ? findNode(map.root, nodeId) : null;
    if (node) {
      props.api.setTitle(node.title);
    }
  }, [documentWorkspace, documentId, props.api]);

  useEffect(() => {
    return onAppEvent(APP_EVENTS.documentRenamed, (detail) => {
      if (detail?.documentId === documentId && detail.title) {
        props.api.setTitle(detail.title);
      }
    });
  }, [documentId, props.api]);

  if (!workspaceRoot || !libraryId || !documentId) {
    return null;
  }
  const ImportedPreviewPane = getUiRenderer("document.importedView");
  if (!ImportedPreviewPane) {
    return (
      <div className="panel-loading">文档渲染器尚未注册…</div>
    );
  }
  return (
    <Suspense fallback={<div className="panel-loading">加载编辑器…</div>}>
      <ImportedPreviewPane
        workspaceRoot={workspaceRoot}
        libraryId={libraryId}
        documentId={documentId}
        panelId={props.api.id}
      />
    </Suspense>
  );
}
