import { beforeEach, describe, expect, it } from "vitest";
import { DOCK_LAYOUT_KEY, resetDockLayout } from "./dockLayout";

beforeEach(() => {
  window.localStorage.clear();
});

describe("dock layout persistence", () => {
  it("uses a versioned storage key", () => {
    expect(DOCK_LAYOUT_KEY).toMatch(/^tauri-notes\.dock-layout\.v\d+$/);
  });

  it("reset only clears the dock layout entry", () => {
    window.localStorage.setItem(DOCK_LAYOUT_KEY, "{}");
    window.localStorage.setItem("tauri-notes.theme", "dark");
    resetDockLayout();
    expect(window.localStorage.getItem(DOCK_LAYOUT_KEY)).toBeNull();
    expect(window.localStorage.getItem("tauri-notes.theme")).toBe("dark");
  });
});
