import type {
  ActionRuntime,
  InputPlatform,
} from "../kernel/action";
import { getAction, registerAction } from "../kernel/action";
import { APP_EVENTS, emitAppEvent } from "../kernel/events";
import type { DialogPort } from "../application/ports/dialogPort";
import type { DocumentActionsPort } from "../application/ports/documentActionsPort";

export type DocumentActionTarget = {
  id: string;
  title: string;
  workspaceRoot: string;
};

export type DocumentActionContext = {
  platform: InputPlatform;
  document: DocumentActionTarget;
  dialogs: DialogPort;
  documentActions: DocumentActionsPort;
  onDeleted?: () => void;
};

function readContext(runtime: ActionRuntime): DocumentActionContext | null {
  const context = runtime.context as Partial<DocumentActionContext> | undefined;
  if (
    !context?.document ||
    !context.dialogs ||
    !context.documentActions
  ) {
    return null;
  }
  return context as DocumentActionContext;
}

function contextOf(
  context: DocumentActionContext,
): Record<string, unknown> {
  return context as unknown as Record<string, unknown>;
}

/**
 * Document actions are shared by every trigger. A desktop context menu and a
 * mobile long-press both dispatch the same action id and payload; only the
 * surrounding menu presentation differs.
 */
export function registerDocumentActions(): void {
  registerAction({
    id: "document.rename",
    title: "重命名文档",
    category: "document",
    scope: "global",
    platforms: ["desktop", "mac", "mobile"],
    defaultBindings: [],
    enabled: (runtime) => readContext(runtime) !== null,
    run: async (runtime) => {
      const context = readContext(runtime);
      if (!context) {
        return;
      }
      const next = (
        await context.dialogs.prompt({
          title: "重命名文档",
          defaultValue: context.document.title,
        })
      )?.trim();
      if (!next || next === context.document.title) {
        return;
      }
      await context.documentActions.rename(
        context.document.workspaceRoot,
        context.document.id,
        next,
      );
      emitAppEvent(APP_EVENTS.documentRenamed, {
        documentId: context.document.id,
        title: next,
      });
      emitAppEvent(APP_EVENTS.documentChanged);
    },
  });

  registerAction({
    id: "document.delete",
    title: "移到回收站",
    category: "document",
    scope: "global",
    platforms: ["desktop", "mac", "mobile"],
    defaultBindings: [],
    enabled: (runtime) => readContext(runtime) !== null,
    run: async (runtime) => {
      const context = readContext(runtime);
      if (!context) {
        return;
      }
      const confirmed = await context.dialogs.confirm({
        title: "删除文档？",
        message: `“${context.document.title}”会移到回收站，可稍后恢复。`,
        confirmLabel: "移到回收站",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }
      await context.documentActions.moveToTrash(
        context.document.workspaceRoot,
        context.document.id,
      );
      emitAppEvent(APP_EVENTS.documentDeleted, {
        documentId: context.document.id,
        root: context.document.workspaceRoot,
      });
      emitAppEvent(APP_EVENTS.documentChanged);
      context.onDeleted?.();
    },
  });
}

export async function runDocumentAction(
  id: "document.rename" | "document.delete",
  context: DocumentActionContext,
): Promise<boolean> {
  const action = getAction(id);
  if (!action) {
    return false;
  }
  const runtime: ActionRuntime = {
    source: "programmatic",
    platform: context.platform,
    hasWorkspace: true,
    runCommand: () => {},
    context: contextOf(context),
  };
  if (action.enabled && !action.enabled(runtime)) {
    return false;
  }
  await action.run(runtime);
  return true;
}