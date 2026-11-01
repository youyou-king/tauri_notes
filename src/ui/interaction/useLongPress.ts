import { useCallback, useEffect, useRef } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

export type PressPoint = { x: number; y: number };

type Options = {
  onLongPress: (point: PressPoint) => void;
  delayMs?: number;
  moveTolerance?: number;
  disabled?: boolean;
};

/**
 * Pointer-based long press with a context-menu fallback. Works for touch and
 * pen; mouse right-click is handled through contextmenu so it opens the same
 * action sheet as a long press.
 */
export function useLongPress({
  onLongPress,
  delayMs = 500,
  moveTolerance = 10,
  disabled = false,
}: Options) {
  const timer = useRef<number | null>(null);
  const start = useRef<PressPoint | null>(null);
  const lastTriggered = useRef(0);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const trigger = useCallback(
    (point: PressPoint) => {
      lastTriggered.current = Date.now();
      onLongPress(point);
    },
    [onLongPress],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }
      cancel();
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (start.current) {
          trigger(start.current);
        }
      }, delayMs);
    },
    [cancel, delayMs, disabled, trigger],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!start.current) {
        return;
      }
      if (
        Math.abs(event.clientX - start.current.x) > moveTolerance ||
        Math.abs(event.clientY - start.current.y) > moveTolerance
      ) {
        cancel();
      }
    },
    [cancel, moveTolerance],
  );

  const onContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      if (Date.now() - lastTriggered.current < 800) {
        return;
      }
      trigger({ x: event.clientX, y: event.clientY });
    },
    [cancel, trigger],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu,
  };
}