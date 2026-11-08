import { beforeAll, describe, expect, it, vi } from "vitest";
import { clearActionsForTests } from "../../../src/kernel/action";
import {
  registerLibraryActions,
  runLibraryAction,
  type LibraryActionContext,
} from "../../../src/app/libraryActions";
import type { LibraryPort } from "../../../src/application/ports/libraryPort";
import { asLibraryPath } from "../../../src/types";

function context(
  library: Partial<LibraryPort> = {},
  overrides: Partial<LibraryActionContext> = {},
): LibraryActionContext {
  return {
    platform: "mobile",
    library: {
      pickExisting: vi.fn().mockResolvedValue("/app/libraries/imported.note"),
      pickNew: vi.fn().mockResolvedValue(null),
      exportLibrary: vi.fn().mockResolvedValue("/tmp/exported.note"),
      ...library,
    },
    ...overrides,
  };
}

beforeAll(() => {
  clearActionsForTests();
  registerLibraryActions();
});

describe("library actions", () => {
  it("imports and reports the managed path", async () => {
    const onImported = vi.fn();
    const ctx = context({}, { onImported });
    await runLibraryAction("library.import", ctx);
    expect(ctx.library.pickExisting).toHaveBeenCalledOnce();
    expect(onImported).toHaveBeenCalledWith("/app/libraries/imported.note");
  });

  it("does not report an import when cancelled", async () => {
    const onImported = vi.fn();
    const ctx = context(
      { pickExisting: vi.fn().mockResolvedValue(null) },
      { onImported },
    );
    await runLibraryAction("library.import", ctx);
    expect(onImported).not.toHaveBeenCalled();
  });

  it("exports the current library", async () => {
    const onExported = vi.fn();
    const ctx = context(
      {},
      { source: asLibraryPath("/app/libraries/a.note"), onExported },
    );
    await runLibraryAction("library.export", ctx);
    expect(ctx.library.exportLibrary).toHaveBeenCalledWith(
      "/app/libraries/a.note",
    );
    expect(onExported).toHaveBeenCalledWith("/tmp/exported.note");
  });

  it("requires a source for export", async () => {
    const ctx = context();
    await expect(runLibraryAction("library.export", ctx)).resolves.toBe(false);
    expect(ctx.library.exportLibrary).not.toHaveBeenCalled();
  });
});