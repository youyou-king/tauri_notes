import { useEffect, type RefObject } from "react";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { workspaceService } from "../application/workspaceService";
import {
  buildDatabaseTree,
  mergeDatabaseDocuments,
} from "../application/workspaceTree";
import type { WorkspaceView } from "../types";
import { APP_EVENTS, onAppEvent } from "../kernel/events";

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
    return onAppEvent(APP_EVENTS.openBlockDocument, (documentId) => {
      if (documentId) {
        dockRef.current?.openBlockDocument(documentId);
      }
    });
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
    return onAppEvent(APP_EVENTS.documentChanged, handler);
  }, [appendLog, setWorkspace, workspaceRoot]);

  useEffect(() => {
    return onAppEvent(APP_EVENTS.openSource, (docId) => {
      const separator = docId?.indexOf("/") ?? -1;
      if (separator > 0) {
        dockRef.current?.openDocument(
          docId.slice(0, separator),
          docId.slice(separator + 1),
        );
      }
    });
  }, [dockRef]);
}
