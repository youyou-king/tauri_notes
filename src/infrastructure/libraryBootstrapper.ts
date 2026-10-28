import { invoke } from "@tauri-apps/api/core";

export type LibraryStatus = {
  version: number;
  documents: number;
  blocks: number;
  references: number;
  boards: number;
};

type ImportReport = {
  dryRun: boolean;
  documents: number;
  blocks: number;
  skippedEmpty: number;
};

const pending = new Map<string, Promise<LibraryStatus>>();

async function ensureInternal(workspace: string): Promise<LibraryStatus> {
  let status = await invoke<LibraryStatus>("database_status", { workspace });
  if (status.documents > 0) {
    return status;
  }

  await invoke<ImportReport>("import_markdown_workspace", {
    workspace,
    write: true,
  });
  await invoke("import_boards", { workspace });
  status = await invoke<LibraryStatus>("database_status", { workspace });
  return status;
}

/**
 * 幂等初始化：只在正式库为空时导入旧 Markdown 和 board。
 * 同一个工作区的并发调用共用一个 Promise，避免 StrictMode 双执行。
 */
export function ensureLibrary(workspace: string): Promise<LibraryStatus> {
  const existing = pending.get(workspace);
  if (existing) {
    return existing;
  }
  const promise = ensureInternal(workspace).finally(() => {
    pending.delete(workspace);
  });
  pending.set(workspace, promise);
  return promise;
}
