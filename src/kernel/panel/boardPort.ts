import type { Board, ZoomLevel } from "../../domain/board";
import type { BlockId, BoardItemId, DocId } from "../../domain/ids";
import type { ReferenceState, ResolvedBlock } from "../../domain/reference";

export type PinBlockInput = {
  blockId: BlockId;
  text: string;
  docId: DocId;
  docTitle: string;
};

/**
 * Shell-facing board capability. The board feature implements it; panels and
 * shell code depend only on this port.
 */
export type BoardControllerPort = {
  board: Board | null;
  states: Record<string, ReferenceState>;
  sources: ResolvedBlock[];
  open: boolean;
  loading: boolean;
  error: string | null;
  openBoard: () => void;
  closeBoard: () => void;
  pinBlock: (input: PinBlockInput) => Promise<void>;
  addSource: (source: ResolvedBlock) => Promise<void>;
  setZoom: (itemId: BoardItemId, zoom: ZoomLevel) => void;
  setSpan: (itemId: BoardItemId, span: number) => void;
  setHeight: (itemId: BoardItemId, height: number) => void;
  relinkItem: (itemId: BoardItemId, source: ResolvedBlock) => void;
  moveItem: (itemId: BoardItemId, targetIndex: number) => void;
  removeItem: (itemId: BoardItemId) => void;
};
