import { useEffect, type RefObject } from "react";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { libraryService } from "../application/libraryService";
import { workspaceService } from "../application/workspaceService";
import {
  buildDatabaseTree,
  mergeDatabaseDocuments,
} from "../application/workspaceTree";
import type { WorkspaceView } from "../types";
import { APP_EVENTS, onAppEvent } from "../kernel/events";

type Args = {
  workspaceId: string | null;
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
  workspaceId,
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
    if (!workspaceId) {
      return;
    }
    const handler = () => {
      void (async () => {
        try {
          const view = await libraryService.open(workspaceId);
          const documents =
            await workspaceService.listDocuments(view.id);
          const treeRows =
            await workspaceService.loadDocumentTree(view.id);
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
  }, [appendLog, setWorkspace, workspaceId]);

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
