import { beforeEach, describe, expect, it, vi } from "vitest";
import { asLibraryPath } from "../../../../src/types";

const { open, save, importLibrary, exportLibrary, newPath } = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
  importLibrary: vi.fn(),
  exportLibrary: vi.fn(),
  newPath: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open,
  save,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/app"),
  join: vi.fn((...parts: string[]) => parts.join("/")),
}));

vi.mock("../../../../src/application/managedLibraryService", () => ({
  managedLibraryService: {
    import: importLibrary,
    export: exportLibrary,
    list: vi.fn(),
    newPath,
  },
}));

import { createDesktopLibrary, createMobileLibrary } from "../../../../src/runtime/services/library";

describe("library adapters", () => {
  beforeEach(() => {
    open.mockReset();
    save.mockReset();
    importLibrary.mockReset();
    exportLibrary.mockReset();
    newPath.mockReset();
  });

  it("desktop opens external paths directly", async () => {
    open.mockResolvedValue("/tmp/demo.note");
    const library = createDesktopLibrary();
    await expect(library.pickExisting()).resolves.toBe("/tmp/demo.note");
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it("mobile copies external notes into the managed library", async () => {
    open.mockResolvedValue("/tmp/demo.note");
    importLibrary.mockResolvedValue({
      id: "demo",
      title: "demo",
      path: "/app/libraries/demo.note",
    });
    const library = createMobileLibrary();
    await expect(library.pickExisting()).resolves.toBe(
      "/app/libraries/demo.note",
    );
    expect(importLibrary).toHaveBeenCalledWith("/tmp/demo.note");
  });

  it("mobile creates a new library path in managed storage", async () => {
    newPath.mockResolvedValue("/app/libraries/demo-1.note");
    const library = createMobileLibrary();
    await expect(library.pickNew("demo")).resolves.toBe(
      "/app/libraries/demo-1.note",
    );
    expect(newPath).toHaveBeenCalledWith("demo");
  });

  it("desktop keeps using the save dialog for new libraries", async () => {
    save.mockResolvedValue("/tmp/new.note");
    const library = createDesktopLibrary();
    await expect(library.pickNew("demo")).resolves.toBe("/tmp/new.note");
    expect(save).toHaveBeenCalledOnce();
  });

  it("exports through the save dialog and managed service", async () => {
    save.mockResolvedValue("/tmp/out.note");
    exportLibrary.mockResolvedValue("/tmp/out.note");
    const library = createMobileLibrary();
    await expect(
      library.exportLibrary?.(asLibraryPath("/app/libraries/a.note")),
    ).resolves.toBe("/tmp/out.note");
    expect(exportLibrary).toHaveBeenCalledWith(
      "/app/libraries/a.note",
      "/tmp/out.note",
    );
  });

  it("keeps export cancellation as null", async () => {
    save.mockResolvedValue(null);
    const library = createMobileLibrary();
    await expect(
      library.exportLibrary?.(asLibraryPath("/app/libraries/a.note")),
    ).resolves.toBeNull();
    expect(exportLibrary).not.toHaveBeenCalled();
  });

  it("mobile keeps cancellation as null", async () => {
    open.mockResolvedValue(null);
    const library = createMobileLibrary();
    await expect(library.pickExisting()).resolves.toBeNull();
    expect(importLibrary).not.toHaveBeenCalled();
  });
});