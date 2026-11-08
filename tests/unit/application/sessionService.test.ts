import { beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_KEY,
  readSession,
  writeSession,
} from "../../../src/application/sessionService";
import { asLibraryPath } from "../../../src/types";

describe("sessionService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no session exists", () => {
    expect(readSession()).toBeNull();
  });

  it("round-trips libraries, active id and missing entries", () => {
    writeSession(
      [
        { id: "lib_a", path: asLibraryPath("/a.note") },
        { id: "lib_b", path: asLibraryPath("/b.note") },
      ],
      "lib_b",
      {
        activeMapId: "map-1",
        selectedNodeId: "node-2",
        activePanelId: "blockdoc_1",
      },
      [{ id: "lib_gone", path: asLibraryPath("/gone.note") }],
    );
    expect(readSession()).toEqual({
      version: 4,
      libraries: [
        { id: "lib_a", path: "/a.note" },
        { id: "lib_b", path: "/b.note" },
      ],
      activeId: "lib_b",
      missing: [{ id: "lib_gone", path: "/gone.note" }],
      activeMapId: "map-1",
      selectedNodeId: "node-2",
      activePanelId: "blockdoc_1",
    });
  });

  it("ignores sessions from older versions instead of migrating", () => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        version: 3,
        libraries: [{ id: "lib_a", path: "/a.note" }],
        activeId: "lib_a",
      }),
    );
    expect(readSession()).toBeNull();
  });

  it("ignores malformed session data", () => {
    window.localStorage.setItem(SESSION_KEY, "{broken");
    expect(readSession()).toBeNull();
  });
});