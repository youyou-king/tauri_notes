import { invoke } from "@tauri-apps/api/core";
import type { Board, BoardSummary } from "../domain/board";
import type { BoardId } from "../domain/ids";
import type { LibraryId } from "../types";
import type { BoardRepository, Clock, IdGenerator } from "../application/ports";

export class TauriBoardRepository implements BoardRepository {
  list(libraryId: LibraryId): Promise<BoardSummary[]> {
    return invoke<BoardSummary[]>("list_boards_db", {
      libraryId,
    });
  }

  read(libraryId: LibraryId, boardId: BoardId): Promise<Board> {
    return invoke<Board>("read_board_db", {
      libraryId,
      boardId,
    });
  }

  save(libraryId: LibraryId, board: Board): Promise<void> {
    return invoke("save_board_db", { libraryId, board });
  }

  remove(libraryId: LibraryId, boardId: BoardId): Promise<void> {
    return invoke("delete_board_db", {
      libraryId,
      boardId,
    });
  }
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export const browserIds: IdGenerator = {
  boardId: () => randomId("board"),
  boardItemId: () => randomId("viewport"),
  blockId: () => randomId("block"),
};

export const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
};
