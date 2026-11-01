import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type Options = {
  onSwipe: () => void;
  disabled?: boolean;
  threshold?: number;
};

/**
 * Swipe-left gesture for list rows. The same action sheet is opened by a
 * long press or right-click, so touch and mouse users get the same commands.
 */
export function useSwipeLeft({
  onSwipe,
  disabled = false,
  threshold = 64,
}: Options) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled || event.pointerType === "mouse") {
        return;
      }
      start.current = { x: event.clientX, y: event.clientY };
    },
    [disabled],
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
      if (dx <= -threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        onSwipe();
      }
    },
    [disabled, onSwipe, threshold],
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