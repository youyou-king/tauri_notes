import { describe, expect, it, vi } from "vitest";
import { APP_EVENTS, emitAppEvent, onAppEvent } from "./events";

describe("app events", () => {
  it("delivers typed open events and cleans up", () => {
    const handler = vi.fn();
    const off = onAppEvent(APP_EVENTS.searchOpen, handler);
    emitAppEvent(APP_EVENTS.searchOpen);
    expect(handler).toHaveBeenCalledOnce();
    off();
    emitAppEvent(APP_EVENTS.searchOpen);
    expect(handler).toHaveBeenCalledOnce();
  });
});
