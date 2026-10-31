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
  it("carries document event payloads", () => {
    const handler = vi.fn();
    const off = onAppEvent(APP_EVENTS.openBlockDocument, handler);
    emitAppEvent(APP_EVENTS.openBlockDocument, "map-1/node-1");
    expect(handler).toHaveBeenCalledWith("map-1/node-1");
    off();
  });

  it("keeps event names unique", () => {
    const names = Object.values(APP_EVENTS);
    expect(new Set(names).size).toBe(names.length);
  });

});
