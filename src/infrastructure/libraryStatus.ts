import { invoke } from "@tauri-apps/api/core";
import type { LibraryId } from "../types";

export type LibraryStatus = {
  documents: number;
  blocks: number;
  references: number;
  boards: number;
};

const pending = new Map<LibraryId, Promise<LibraryStatus>>();

/**
 * 读取书库数据库状态；同一个书库的并发调用共用一个 Promise，
 * 避免 StrictMode 双执行。
 */
export function loadLibraryStatus(
  libraryId: LibraryId,
): Promise<LibraryStatus> {
  const existing = pending.get(libraryId);
  if (existing) {
    return existing;
  }
  const promise = invoke<LibraryStatus>("database_status", { libraryId }).finally(
    () => {
      pending.delete(libraryId);
    },
  );
  pending.set(libraryId, promise);
  return promise;
}
