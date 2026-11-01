import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type Options = {
  onBack: () => void;
  disabled?: boolean;
  edgeOnly?: boolean;
  threshold?: number;
};

/**
 * Horizontal swipe-back for the stacked mobile shell. Mouse drags are ignored
 * so desktop users can select text without accidentally navigating.
 */
export function useSwipeBack({
  onBack,
  disabled = false,
  edgeOnly = false,
  threshold = 80,
}: Options) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled || event.pointerType === "mouse") {
        return;
      }
      if (edgeOnly && event.clientX > 32) {
        return;
      }
      start.current = { x: event.clientX, y: event.clientY };
    },
    [disabled, edgeOnly],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from || disabled) {
        return;
      }
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (dx >= threshold && dx > Math.abs(dy) * 1.5) {
        onBack();
      }
    },
    [disabled, onBack, threshold],
  );

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel: () => {
      start.current = null;
    },
    onPointerLeave: () => {
      start.current = null;
    },
  };
}