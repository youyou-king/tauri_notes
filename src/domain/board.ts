import type { BlockReference } from "./reference";
import {
  asBoardId,
  asBoardItemId,
  type BoardId,
  type BoardItemId,
} from "./ids";

export const BOARD_VERSION = 1;
export const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export const VIEWPORT_LIMITS = {
  minSpan: 1,
  maxSpan: 3,
  minHeight: 180,
  maxHeight: 1200,
  defaultSpan: 1,
  defaultHeight: 360,
} as const;

export type BoardViewport = {
  id: BoardItemId;
  reference: BlockReference;
  span: number;
  height: number;
  zoom: ZoomLevel;
  collapsed: boolean;
};

export type Board = {
  version: typeof BOARD_VERSION;
  id: BoardId;
  title: string;
  items: BoardViewport[];
};

export type BoardSummary = {
  id: BoardId;
  title: string;
  itemCount: number;
  updatedAt: string;
};

export function createBoard(id: string, title: string): Board {
  return {
    version: BOARD_VERSION,
    id: asBoardId(id),
    title: title.trim() || "未命名对照板",
    items: [],
  };
}

export function clampSpan(value: number): number {
  return Math.min(
    VIEWPORT_LIMITS.maxSpan,
    Math.max(VIEWPORT_LIMITS.minSpan, Math.round(value)),
  );
}

export function clampHeight(value: number): number {
  return Math.min(
    VIEWPORT_LIMITS.maxHeight,
    Math.max(VIEWPORT_LIMITS.minHeight, Math.round(value)),
  );
}

export function normalizeZoom(value: number): ZoomLevel {
  return ZOOM_LEVELS.reduce((nearest, level) =>
    Math.abs(level - value) < Math.abs(nearest - value) ? level : nearest,
  );
}

export function createViewport(
  id: string,
  reference: BlockReference,
): BoardViewport {
  return {
    id: asBoardItemId(id),
    reference,
    span: VIEWPORT_LIMITS.defaultSpan,
    height: VIEWPORT_LIMITS.defaultHeight,
    zoom: 1,
    collapsed: false,
  };
}

export function addViewport(board: Board, viewport: BoardViewport): Board {
  return { ...board, items: [...board.items, viewport] };
}

export function updateViewport(
  board: Board,
  itemId: BoardItemId,
  patch: Partial<Omit<BoardViewport, "id" | "reference">>,
): Board {
  return {
    ...board,
    items: board.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }
      return {
        ...item,
        ...patch,
        span: clampSpan(patch.span ?? item.span),
        height: clampHeight(patch.height ?? item.height),
        zoom: normalizeZoom(patch.zoom ?? item.zoom),
      };
    }),
  };
}

export function moveViewport(
  board: Board,
  itemId: BoardItemId,
  targetIndex: number,
): Board {
  const currentIndex = board.items.findIndex((item) => item.id === itemId);
  if (currentIndex < 0) {
    return board;
  }
  const items = [...board.items];
  const [item] = items.splice(currentIndex, 1);
  const index = Math.max(0, Math.min(items.length, targetIndex));
  items.splice(index, 0, item);
  return { ...board, items };
}

export function removeViewport(board: Board, itemId: BoardItemId): Board {
  return {
    ...board,
    items: board.items.filter((item) => item.id !== itemId),
  };
}
