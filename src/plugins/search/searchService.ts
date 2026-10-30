import { command } from "../../infrastructure/tauri/client";
import type { SearchHit } from "../../types";

export const searchService = {
  search(
    workspace: string,
    query: string,
    limit = 30,
  ): Promise<SearchHit[]> {
    return command("search_blocks_db", { workspace, query, limit });
  },
};
