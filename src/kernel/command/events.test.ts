import { describe, expect, it } from "vitest";
import {
  commandEventName,
  dispatchCommandEvent,
} from "./events";

describe("command events", () => {
  it("maps command ids to event names and dispatches detail", () => {
    expect(commandEventName("viewport.pick")).toBe(
      "command:viewport.pick",
    );
    let detail: unknown;
    const handler = (event: Event) => {
      detail = (event as CustomEvent).detail;
    };
    window.addEventListener("command:viewport.pick", handler);
    dispatchCommandEvent("viewport.pick", { source: "test" });
    window.removeEventListener("command:viewport.pick", handler);
    expect(detail).toEqual({ source: "test" });
  });
});
