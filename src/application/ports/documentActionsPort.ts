/**
 * Document command boundary used by shells and future actions. The
 * implementation may call documentService today and a sync-aware repository
 * later; callers do not depend on either.
 */
export type DocumentActionsPort = {
  rename(
    workspaceRoot: string,
    documentId: string,
    title: string,
  ): Promise<void>;
  moveToTrash(workspaceRoot: string, documentId: string): Promise<void>;
};