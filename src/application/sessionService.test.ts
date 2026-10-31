import { beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_KEY,
  clearWorkspaceTitle,
  readSession,
  readWorkspaceTitle,
  writeSession,
  writeWorkspaceTitle,
} from "./sessionService";

describe("sessionService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no session exists", () => {
    expect(readSession()).toBeNull();
  });

  it("round-trips roots and active selection", () => {
    writeSession(["/a.note", "/b.note"], "/b.note", {
      activeMapId: "map-1",
      selectedNodeId: "node-2",
    });
    expect(readSession()).toEqual({
      version: 1,
      roots: ["/a.note", "/b.note"],
      activeRoot: "/b.note",
      activeMapId: "map-1",
      selectedNodeId: "node-2",
    });
  });

  it("defaults missing selection for old session data", () => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        version: 1,
        roots: ["/a.note"],
        activeRoot: "/a.note",
      }),
    );
    expect(readSession()).toMatchObject({
      activeMapId: null,
      selectedNodeId: null,
    });
  });

  it("ignores malformed session data", () => {
    window.localStorage.setItem(SESSION_KEY, "{broken");
    expect(readSession()).toBeNull();
  });

  it("persists workspace titles independently", () => {
    writeWorkspaceTitle("/a.note", "我的知识库");
    expect(readWorkspaceTitle("/a.note")).toBe("我的知识库");
    clearWorkspaceTitle("/a.note");
    expect(readWorkspaceTitle("/a.note")).toBeNull();
  });
});
