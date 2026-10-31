import { Suspense, useEffect } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { documentService } from "../../application/documentService";
import { findNode } from "../../domain/tree";
import { getUiRenderer } from "../../kernel/ui";
import { usePanelContext } from "./PanelContext";
import { APP_EVENTS, onAppEvent } from "../../kernel/events";

export type BlockDocParams = {
  documentId?: string;
  workspaceRoot?: string;
};

export function BlockDocumentPanel(
  props: IDockviewPanelProps<BlockDocParams>,
) {
  const context = usePanelContext();
  const documentId = props.params.documentId;
  const workspaceRoot =
    props.params.workspaceRoot ?? context?.workspace?.root ?? "";
  const documentWorkspace = context?.workspaces.find(
    (item) => item.root === workspaceRoot,
  );

  useEffect(() => {
    if (!workspaceRoot || !documentId) {
      return;
    }
    const refresh = () => {
      void documentService
        .getTitle(workspaceRoot, documentId)
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
  }, [workspaceRoot, documentId, props.api]);

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

  if (!workspaceRoot || !documentId) {
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
        documentId={documentId}
        panelId={props.api.id}
      />
    </Suspense>
  );
}
