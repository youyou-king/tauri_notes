import type { Board, BoardSummary } from "../domain/board";
import type { BoardId } from "../domain/ids";
import type { BlockReference, ReferenceState, ResolvedBlock } from "../domain/reference";

export type BoardRepository = {
  list(workspaceRoot: string): Promise<BoardSummary[]>;
  read(workspaceRoot: string, boardId: BoardId): Promise<Board>;
  save(workspaceRoot: string, board: Board): Promise<void>;
  remove(workspaceRoot: string, boardId: BoardId): Promise<void>;
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
