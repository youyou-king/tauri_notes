import { useEffect, type RefObject } from "react";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { workspaceService } from "../application/workspaceService";
import {
  buildDatabaseTree,
  mergeDatabaseDocuments,
} from "../application/workspaceTree";
import type { WorkspaceView } from "../types";

type Args = {
  workspaceRoot: string | null;
  setWorkspace: (
    next:
      | WorkspaceView
      | null
      | ((current: WorkspaceView | null) => WorkspaceView | null),
  ) => void;
  appendLog: (line: string) => void;
  dockRef: RefObject<DockWorkspaceHandle | null>;
};

export function useDocumentEvents({
  workspaceRoot,
  setWorkspace,
  appendLog,
  dockRef,
}: Args) {
  useEffect(() => {
    const handler = (event: Event) => {
      const documentId = (event as CustomEvent<string>).detail;
      if (documentId) {
        dockRef.current?.openBlockDocument(documentId);
      }
    };
    window.addEventListener("tauri-notes:open-block-document", handler);
    return () =>
      window.removeEventListener("tauri-notes:open-block-document", handler);
  }, [dockRef]);

  useEffect(() => {
    if (!workspaceRoot) {
      return;
    }
    const handler = () => {
      void (async () => {
        try {
          const view = await workspaceService.open(workspaceRoot);
          const documents =
            await workspaceService.listDocuments(workspaceRoot);
          const treeRows =
            await workspaceService.loadDocumentTree(workspaceRoot);
          setWorkspace(
            treeRows.length > 0
              ? buildDatabaseTree(view, treeRows)
              : mergeDatabaseDocuments(view, documents),
          );
        } catch (error) {
          appendLog(`刷新文档树失败：${String(error)}`);
        }
      })();
    };
    window.addEventListener("tauri-notes:document-changed", handler);
    return () =>
      window.removeEventListener("tauri-notes:document-changed", handler);
  }, [appendLog, setWorkspace, workspaceRoot]);

  useEffect(() => {
    const handler = (event: Event) => {
      const docId = (event as CustomEvent<string>).detail;
      const separator = docId?.indexOf("/") ?? -1;
      if (separator > 0) {
        dockRef.current?.openDocument(
          docId.slice(0, separator),
          docId.slice(separator + 1),
        );
      }
    };
    window.addEventListener("tauri-notes:open-source", handler);
    return () =>
      window.removeEventListener("tauri-notes:open-source", handler);
  }, [dockRef]);
}
