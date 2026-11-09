import type { ActionRuntime, InputPlatform } from "../kernel/action";
import { getAction, registerAction } from "../kernel/action";
import type { LibraryPort } from "../application/ports/libraryPort";
import type { LibraryPath } from "../types";

export type LibraryActionContext = {
  platform: InputPlatform;
  library: LibraryPort;
  source?: LibraryPath;
  onImported?: (path: LibraryPath) => void;
  onExported?: (path: LibraryPath) => void;
};

function readContext(runtime: ActionRuntime): LibraryActionContext | null {
  const context = runtime.context as Partial<LibraryActionContext> | undefined;
  return context?.library ? (context as LibraryActionContext) : null;
}

export function registerLibraryActions(): void {
  registerAction({
    id: "library.import",
    title: "导入知识库",
    category: "library",
    scope: "global",
    platforms: ["desktop", "mac", "mobile"],
    defaultBindings: [],
    enabled: (runtime) => readContext(runtime) !== null,
    run: async (runtime) => {
      const context = readContext(runtime);
      if (!context) {
        return;
      }
      const path = await context.library.pickExisting();
      if (path) {
        context.onImported?.(path);
      }
    },
  });

  registerAction({
    id: "library.export",
    title: "导出知识库",
    category: "library",
    scope: "global",
    platforms: ["desktop", "mac", "mobile"],
    defaultBindings: [],
    enabled: (runtime) => Boolean(readContext(runtime)?.source),
    run: async (runtime) => {
      const context = readContext(runtime);
      if (!context?.source || !context.library.exportLibrary) {
        return;
      }
      const path = await context.library.exportLibrary(context.source);
      if (path) {
        context.onExported?.(path);
      }
    },
  });
}

export async function runLibraryAction(
  id: "library.import" | "library.export",
  context: LibraryActionContext,
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
    context: context as unknown as Record<string, unknown>,
  };
  if (action.enabled && !action.enabled(runtime)) {
    return false;
  }
  await action.run(runtime);
  return true;
}