import { lazy, Suspense, useEffect } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { documentService } from "../../application/documentService";
import { findNode } from "../../domain/tree";
import { usePanelContext } from "./PanelContext";

export type BlockDocParams = {
  documentId?: string;
  workspaceRoot?: string;
};

const ImportedPreviewPane = lazy(
  () => import("../import/ImportedPreviewPane"),
);

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
    window.addEventListener("tauri-notes:document-renamed", refresh);
    window.addEventListener("tauri-notes:maps-changed", refresh);
    return () => {
      window.removeEventListener("tauri-notes:document-renamed", refresh);
      window.removeEventListener("tauri-notes:maps-changed", refresh);
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
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ documentId?: string; title?: string }>
      ).detail;
      if (detail?.documentId === documentId && detail.title) {
        props.api.setTitle(detail.title);
      }
    };
    window.addEventListener("tauri-notes:document-renamed", handler);
    return () =>
      window.removeEventListener("tauri-notes:document-renamed", handler);
  }, [documentId, props.api]);

  if (!workspaceRoot || !documentId) {
    return null;
  }
  return (
    <Suspense fallback={<div className="panel-loading">加载编辑器…</div>}>
      <ImportedPreviewPane
        workspaceRoot={workspaceRoot}
        documentId={documentId}
      />
    </Suspense>
  );
}
