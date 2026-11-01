import { beforeAll, describe, expect, it, vi } from "vitest";
import { clearActionsForTests } from "../kernel/action";
import {
  registerDocumentActions,
  runDocumentAction,
  type DocumentActionContext,
} from "./documentActions";

function context(
  overrides: Partial<DocumentActionContext> = {},
): DocumentActionContext {
  return {
    platform: "mobile",
    document: {
      id: "doc-1",
      title: "原标题",
      workspaceRoot: "/tmp/demo.note",
    },
    dialogs: {
      confirm: vi.fn().mockResolvedValue(true),
      prompt: vi.fn().mockResolvedValue("新标题"),
      alert: vi.fn(),
    },
    documentActions: {
      rename: vi.fn().mockResolvedValue(undefined),
      moveToTrash: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

beforeAll(() => {
  clearActionsForTests();
  registerDocumentActions();
});

describe("document actions", () => {
  it("renames through the same action used by mobile and desktop triggers", async () => {
    const ctx = context();
    const done = await runDocumentAction("document.rename", ctx);
    expect(done).toBe(true);
    expect(ctx.dialogs.prompt).toHaveBeenCalledOnce();
    expect(ctx.documentActions.rename).toHaveBeenCalledWith(
      "/tmp/demo.note",
      "doc-1",
      "新标题",
    );
  });

  it("does not rename when the prompt is cancelled", async () => {
    const ctx = context({
      dialogs: {
        confirm: vi.fn(),
        prompt: vi.fn().mockResolvedValue(null),
        alert: vi.fn(),
      },
    });
    await runDocumentAction("document.rename", ctx);
    expect(ctx.documentActions.rename).not.toHaveBeenCalled();
  });

  it("deletes through the same action and reports completion", async () => {
    const onDeleted = vi.fn();
    const ctx = context({ onDeleted });
    await runDocumentAction("document.delete", ctx);
    expect(ctx.documentActions.moveToTrash).toHaveBeenCalledWith(
      "/tmp/demo.note",
      "doc-1",
    );
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("does not delete when confirmation is cancelled", async () => {
    const ctx = context({
      dialogs: {
        confirm: vi.fn().mockResolvedValue(false),
        prompt: vi.fn(),
        alert: vi.fn(),
      },
    });
    await runDocumentAction("document.delete", ctx);
    expect(ctx.documentActions.moveToTrash).not.toHaveBeenCalled();
  });
});