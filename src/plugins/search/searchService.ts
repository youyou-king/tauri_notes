import { command } from "../../infrastructure/tauri/client";
import type { LibraryId, SearchHit } from "../../types";

export const searchService = {
  search(
    libraryId: LibraryId,
    query: string,
    limit = 30,
  ): Promise<SearchHit[]> {
    return command("search_blocks_db", { libraryId, query, limit });
  },
};
