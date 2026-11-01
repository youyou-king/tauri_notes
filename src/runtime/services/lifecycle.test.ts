import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebLifecycle } from "./lifecycle";

describe("web lifecycle", () => {
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

  it("reports pagehide", () => {
    const lifecycle = createWebLifecycle();
    const handler = vi.fn();
    const unsubscribe = lifecycle.onBackground(handler);
    window.dispatchEvent(new Event("pagehide"));
    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
  });
});