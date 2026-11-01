import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { managedLibraryService } from "./managedLibraryService";

describe("managed library service", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("lists app-private libraries", async () => {
    invoke.mockResolvedValue([
      { id: "a", title: "a", path: "/tmp/a.note" },
    ]);
    await expect(managedLibraryService.list()).resolves.toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("list_managed_libraries");
  });

  it("creates a managed path for a new library", async () => {
    invoke.mockResolvedValue("/app/libraries/demo-1.note");
    await expect(
      managedLibraryService.newPath("demo"),
    ).resolves.toBe("/app/libraries/demo-1.note");
    expect(invoke).toHaveBeenCalledWith("new_managed_library_path", {
      title: "demo",
    });
  });

  it("imports an external note", async () => {
    invoke.mockResolvedValue({ id: "b", title: "b", path: "/tmp/b.note" });
    await managedLibraryService.import("/tmp/source.note");
    expect(invoke).toHaveBeenCalledWith("import_managed_library", {
      source: "/tmp/source.note",
    });
  });
});