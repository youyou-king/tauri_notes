import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useLongPress } from "../../../../src/ui/interaction/useLongPress";
import { useSwipeBack } from "../../../../src/ui/interaction/useSwipeBack";
import { useSwipeLeft } from "../../../../src/ui/interaction/useSwipeLeft";

function pointer(
  x: number,
  y: number,
  pointerType = "touch",
): ReactPointerEvent {
  return {
    clientX: x,
    clientY: y,
    pointerType,
    button: 0,
  } as ReactPointerEvent;
}

describe("mobile gestures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("triggers a long press after the delay", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => {
      result.current.onPointerDown(pointer(10, 10));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledWith({ x: 10, y: 10 });
  });

  it("cancels when the pointer moves", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => {
      result.current.onPointerDown(pointer(10, 10));
      result.current.onPointerMove(pointer(40, 10));
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("opens the same action from contextmenu", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    const event = {
      clientX: 20,
      clientY: 30,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Parameters<typeof result.current.onContextMenu>[0];
    act(() => {
      result.current.onContextMenu(event);
    });
    expect(onLongPress).toHaveBeenCalledWith({ x: 20, y: 30 });
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("opens row actions on a left swipe", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipeLeft({ onSwipe }));
    act(() => {
      result.current.onPointerDown(pointer(160, 100));
      result.current.onPointerUp(pointer(80, 104));
    });
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("triggers swipe back only past the threshold", () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack({ onBack }));
    act(() => {
      result.current.onPointerDown(pointer(20, 100));
      result.current.onPointerUp(pointer(60, 105));
    });
    expect(onBack).not.toHaveBeenCalled();
    act(() => {
      result.current.onPointerDown(pointer(20, 100));
      result.current.onPointerUp(pointer(140, 110));
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});