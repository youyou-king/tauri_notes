import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardService } from "../application/boardService";
import {
  clampHeight,
  clampSpan,
  moveViewport,
  normalizeZoom,
  ZOOM_LEVELS,
  type Board,
  type BoardViewport,
  type ZoomLevel,
} from "../domain/board";
import { blockFingerprint } from "../domain/block";
import type { BoardItemId } from "../domain/ids";
import type { ReferenceState, ResolvedBlock } from "../domain/reference";
import {
  type BoardControllerPort,
  type PinBlockInput,
} from "../kernel/sdk";
import { browserIds, systemClock } from "../infrastructure/tauriBoardRepository";
import { TauriBoardRepository } from "../infrastructure/tauriBoardRepository";
import { TauriReferenceResolver } from "../infrastructure/tauriReferenceResolver";

export type BoardController = BoardControllerPort;
export type { PinBlockInput };

export function useBoardController(
  workspaceRoot: string | null,
): BoardController {
  const service = useMemo(() => {
    if (!workspaceRoot) {
      return null;
    }
    return new BoardService(
      workspaceRoot,
      new TauriBoardRepository(),
      new TauriReferenceResolver(workspaceRoot),
      browserIds,
      systemClock,
    );
  }, [workspaceRoot]);

  const [board, setBoard] = useState<Board | null>(null);
  const [states, setStates] = useState<Record<string, ReferenceState>>({});
  const [sources, setSources] = useState<ResolvedBlock[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (target: Board) => {
      if (!service) {
        return;
      }
      const next = await service.resolveBoard(target);
      setStates(next);
      const list = await service.listSources();
      setSources(list);
    },
    [service],
  );

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setStates({});
    setSources([]);
    setOpen(false);
    setError(null);
    if (!service) {
      return;
    }

    setLoading(true);
    service
      .list()
      .then(async (summaries) => {
        if (cancelled || summaries.length === 0) {
          return;
        }
        const latest = await service.load(summaries[0].id);
        if (!cancelled) {
          setBoard(latest);
          await resolve(latest);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolve, service]);

  const openBoard = useCallback(() => {
    setOpen(true);
    if (!service) {
      return;
    }
    if (board) {
      void resolve(board);
      return;
    }
    setLoading(true);
    service
      .create("对照板")
      .then(async (next) => {
        setBoard(next);
        await resolve(next);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [board, resolve, service]);

  const closeBoard = useCallback(() => setOpen(false), []);

  const persist = useCallback(
    (next: Board) => {
      setBoard(next);
      void service?.save(next).catch((err) => setError(String(err)));
    },
    [service],
  );

  const pinBlock = useCallback(
    async (input: PinBlockInput) => {
      if (!service) {
        return;
      }
      setError(null);
      try {
        const target = board ?? (await service.create("对照板"));
        const next = await service.addReference(target, {
          blockId: input.blockId,
          lastDocId: input.docId,
          lastTitle: input.docTitle,
          fingerprint: blockFingerprint(input.text),
        });
        setOpen(true);
        persist(next);
        await resolve(next);
      } catch (err) {
        setError(String(err));
      }
    },
    [board, persist, resolve, service],
  );

  const addSource = useCallback(
    async (source: ResolvedBlock) => {
      if (!service) {
        return;
      }
      setError(null);
      try {
        const target = board ?? (await service.create("对照板"));
        const next = await service.addReference(target, {
          blockId: source.blockId,
          lastDocId: source.docId,
          lastTitle: source.docTitle,
          fingerprint: source.fingerprint,
        });
        setOpen(true);
        persist(next);
        await resolve(next);
      } catch (err) {
        setError(String(err));
      }
    },
    [board, persist, resolve, service],
  );

  const setZoom = useCallback(
    (itemId: BoardItemId, zoom: ZoomLevel) => {
      if (!board) {
        return;
      }
      const next: Board = {
        ...board,
        items: board.items.map((item) =>
          item.id === itemId
            ? { ...item, zoom: normalizeZoom(zoom) }
            : item,
        ),
      };
      persist(next);
    },
    [board, persist],
  );

  const setSpan = useCallback(
    (itemId: BoardItemId, span: number) => {
      if (!board) {
        return;
      }
      persist({
        ...board,
        items: board.items.map((item) =>
          item.id === itemId ? { ...item, span: clampSpan(span) } : item,
        ),
      });
    },
    [board, persist],
  );

  const setHeight = useCallback(
    (itemId: BoardItemId, height: number) => {
      if (!board) {
        return;
      }
      persist({
        ...board,
        items: board.items.map((item) =>
          item.id === itemId ? { ...item, height: clampHeight(height) } : item,
        ),
      });
    },
    [board, persist],
  );

  const removeItem = useCallback(
    (itemId: BoardItemId) => {
      if (!board) {
        return;
      }
      persist({
        ...board,
        items: board.items.filter((item) => item.id !== itemId),
      });
    },
    [board, persist],
  );

  const moveItem = useCallback(
    (itemId: BoardItemId, targetIndex: number) => {
      if (!board) {
        return;
      }
      persist(moveViewport(board, itemId, targetIndex));
    },
    [board, persist],
  );

  const relinkItem = useCallback(
    (itemId: BoardItemId, source: ResolvedBlock) => {
      if (!board) {
        return;
      }
      persist({
        ...board,
        items: board.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                reference: {
                  blockId: source.blockId,
                  lastDocId: source.docId,
                  lastTitle: source.docTitle,
                  fingerprint: source.fingerprint,
                },
              }
            : item,
        ),
      });
      void resolve({
        ...board,
        items: board.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                reference: {
                  blockId: source.blockId,
                  lastDocId: source.docId,
                  lastTitle: source.docTitle,
                  fingerprint: source.fingerprint,
                },
              }
            : item,
        ),
      });
    },
    [board, persist, resolve],
  );

  return {
    board,
    states,
    sources,
    open,
    loading,
    error,
    openBoard,
    closeBoard,
    pinBlock,
    addSource,
    setZoom,
    setSpan,
    setHeight,
    relinkItem,
    moveItem,
    removeItem,
  };
}

export function availableZooms(): readonly ZoomLevel[] {
  return ZOOM_LEVELS;
}

export type { BoardViewport };
