import {
  addViewport,
  createBoard,
  createViewport,
  moveViewport,
  removeViewport,
  updateViewport,
  type Board,
  type BoardSummary,
  type BoardViewport,
} from "../domain/board";
import type { BoardId, BoardItemId } from "../domain/ids";
import type { BlockReference, ReferenceState, ResolvedBlock } from "../domain/reference";
import type {
  BoardRepository,
  Clock,
  IdGenerator,
  ReferenceResolver,
} from "./ports";

export class BoardService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly boards: BoardRepository,
    private readonly resolver: ReferenceResolver,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  list(): Promise<BoardSummary[]> {
    return this.boards.list(this.workspaceRoot);
  }

  load(boardId: BoardId): Promise<Board> {
    return this.boards.read(this.workspaceRoot, boardId);
  }

  save(board: Board): Promise<void> {
    return this.boards.save(this.workspaceRoot, board);
  }

  async create(title: string): Promise<Board> {
    const board = createBoard(this.ids.boardId(), title);
    await this.boards.save(this.workspaceRoot, board);
    return board;
  }

  async addReference(
    board: Board,
    reference: BlockReference,
    atIndex?: number,
  ): Promise<Board> {
    const viewport = createViewport(this.ids.boardItemId(), reference);
    const next = addViewport(board, viewport);
    if (atIndex === undefined) {
      return next;
    }
    return moveViewport(next, viewport.id, atIndex);
  }

  async updateItem(
    board: Board,
    itemId: BoardItemId,
    patch: Partial<Omit<BoardViewport, "id" | "reference">>,
  ): Promise<Board> {
    return updateViewport(board, itemId, patch);
  }

  async moveItem(
    board: Board,
    itemId: BoardItemId,
    targetIndex: number,
  ): Promise<Board> {
    return moveViewport(board, itemId, targetIndex);
  }

  async removeItem(board: Board, itemId: BoardItemId): Promise<Board> {
    return removeViewport(board, itemId);
  }

  async listSources(): Promise<ResolvedBlock[]> {
    return (await this.resolver.list?.()) ?? [];
  }

  async relinkItem(
    board: Board,
    itemId: BoardItemId,
    reference: BlockReference,
  ): Promise<Board> {
    return {
      ...board,
      items: board.items.map((item) =>
        item.id === itemId ? { ...item, reference } : item,
      ),
    };
  }

  async resolveBoard(
    board: Board,
  ): Promise<Record<string, ReferenceState>> {
    this.resolver.reload?.();
    const entries = await Promise.all(
      board.items.map(async (item) => {
        const state = await this.resolver.resolve(item.reference);
        return [item.id, state] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async rename(board: Board, title: string): Promise<Board> {
    return { ...board, title: title.trim() || "未命名对照板" };
  }

  now(): string {
    return this.clock.nowIso();
  }
}
