/**
 * Document command boundary used by shells and future actions. The
 * implementation may call documentService today and a sync-aware repository
 * later; callers do not depend on either.
 */
import type { LibraryId } from "../../types";

export type DocumentActionsPort = {
  rename(
    libraryId: LibraryId,
    documentId: string,
    title: string,
  ): Promise<void>;
  moveToTrash(libraryId: LibraryId, documentId: string): Promise<void>;
};