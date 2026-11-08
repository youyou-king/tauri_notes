import type { Board, BoardSummary } from "../domain/board";
import type { BoardId } from "../domain/ids";
import type { LibraryId } from "../types";
import type { BlockReference, ReferenceState, ResolvedBlock } from "../domain/reference";

export type BoardRepository = {
  list(libraryId: LibraryId): Promise<BoardSummary[]>;
  read(libraryId: LibraryId, boardId: BoardId): Promise<Board>;
  save(libraryId: LibraryId, board: Board): Promise<void>;
  remove(libraryId: LibraryId, boardId: BoardId): Promise<void>;
};

export type ReferenceResolver = {
  resolve(reference: BlockReference): Promise<ReferenceState>;
  list?: () => Promise<ResolvedBlock[]>;
  reload?: () => void;
};

export type IdGenerator = {
  boardId(): string;
  boardItemId(): string;
  blockId(): string;
};

export type Clock = {
  nowIso(): string;
};
