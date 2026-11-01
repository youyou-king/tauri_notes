import { beforeEach, describe, expect, it, vi } from "vitest";

const { open, importLibrary } = vi.hoisted(() => ({
  open: vi.fn(),
  importLibrary: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open,
  save: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/app"),
  join: vi.fn((...parts: string[]) => parts.join("/")),
}));

vi.mock("../../application/managedLibraryService", () => ({
  managedLibraryService: {
    import: importLibrary,
    list: vi.fn(),
  },
}));

import { createDesktopLibrary, createMobileLibrary } from "./library";

describe("library adapters", () => {
  beforeEach(() => {
    open.mockReset();
    importLibrary.mockReset();
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

  it("mobile keeps cancellation as null", async () => {
    open.mockResolvedValue(null);
    const library = createMobileLibrary();
    await expect(library.pickExisting()).resolves.toBeNull();
    expect(importLibrary).not.toHaveBeenCalled();
  });
});