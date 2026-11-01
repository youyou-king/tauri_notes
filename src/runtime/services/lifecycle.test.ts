import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }));

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

import { createWebLifecycle } from "./lifecycle";

describe("web lifecycle", () => {
  beforeEach(() => {
    listenMock.mockReset();
    listenMock.mockResolvedValue(() => {});
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("reports a hidden document", () => {
    const lifecycle = createWebLifecycle();
    const handler = vi.fn();
    const unsubscribe = lifecycle.onBackground(handler);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("reports Tauri paused events", async () => {
    const paused: { current: (() => void) | null } = { current: null };
    listenMock.mockImplementation(async (_event, callback) => {
      paused.current = callback as () => void;
      return () => {};
    });
    const lifecycle = createWebLifecycle();
    const handler = vi.fn();
    const unsubscribe = lifecycle.onBackground(handler);
    await Promise.resolve();
    expect(listenMock).toHaveBeenCalledWith(
      "tauri://paused",
      expect.any(Function),
    );
    paused.current?.();
    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("reports pagehide", () => {
    const lifecycle = createWebLifecycle();
    const handler = vi.fn();
    const unsubscribe = lifecycle.onBackground(handler);
    window.dispatchEvent(new Event("pagehide"));
    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
  });
});