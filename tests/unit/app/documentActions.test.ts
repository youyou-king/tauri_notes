import { beforeAll, describe, expect, it, vi } from "vitest";
import { clearActionsForTests } from "../../../src/kernel/action";
import { APP_EVENTS, onAppEvent } from "../../../src/kernel/events";
import {
  registerDocumentActions,
  runDocumentAction,
  type DocumentActionContext,
} from "../../../src/app/documentActions";

function context(
  overrides: Partial<DocumentActionContext> = {},
): DocumentActionContext {
  return {
    platform: "mobile",
    document: {
      id: "doc-1",
      title: "原标题",
      workspaceId: "lib_demo",
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
  it("opens the document through the shared action", async () => {
    const received: string[] = [];
    const unsubscribe = onAppEvent(APP_EVENTS.openBlockDocument, (id) => {
      received.push(id);
    });
    try {
      await runDocumentAction("document.open", context());
    } finally {
      unsubscribe();
    }
    expect(received).toEqual(["doc-1"]);
  });

  it("renames through the same action used by mobile and desktop triggers", async () => {
    const ctx = context();
    const done = await runDocumentAction("document.rename", ctx);
    expect(done).toBe(true);
    expect(ctx.dialogs.prompt).toHaveBeenCalledOnce();
    expect(ctx.documentActions.rename).toHaveBeenCalledWith(
      "lib_demo",
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

  it("deletes through the same action and reports library identity", async () => {
    const onDeleted = vi.fn();
    const ctx = context({ onDeleted });
    const events: Array<{ documentId?: string; libraryId?: string }> = [];
    const unsubscribe = onAppEvent(APP_EVENTS.documentDeleted, (detail) => {
      events.push(detail);
    });
    try {
      await runDocumentAction("document.delete", ctx);
    } finally {
      unsubscribe();
    }
    expect(ctx.documentActions.moveToTrash).toHaveBeenCalledWith(
      "lib_demo",
      "doc-1",
    );
    expect(events).toEqual([
      { documentId: "doc-1", libraryId: "lib_demo" },
    ]);
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