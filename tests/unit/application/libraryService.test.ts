import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { libraryService } from "../../../src/application/libraryService";

describe("library service", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("registers a path and returns the workspace handle", async () => {
    invoke.mockResolvedValue({ id: "lib_a", root: "/a.note" });
    await libraryService.register("/a.note");
    expect(invoke).toHaveBeenCalledWith("register_library", {
      path: "/a.note",
    });
  });

  it("opens, relocates, and lists by stable id", async () => {
    invoke.mockResolvedValue({ id: "lib_a", root: "/a.note" });
    await libraryService.open("lib_a");
    expect(invoke).toHaveBeenCalledWith("open_library", { id: "lib_a" });

    await libraryService.rename("lib_a", "新标题");
    expect(invoke).toHaveBeenCalledWith("rename_library", {
      id: "lib_a",
      title: "新标题",
    });

    await libraryService.relocate("lib_a", "/b.note");
    expect(invoke).toHaveBeenCalledWith("relocate_library", {
      id: "lib_a",
      path: "/b.note",
    });

    invoke.mockResolvedValue(true);
    await expect(libraryService.forget("lib_a")).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("forget_library", { id: "lib_a" });
  });
});