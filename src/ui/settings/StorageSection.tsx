import { useCallback, useEffect, useState } from "react";
import { documentService } from "../../application/documentService";
import { workspaceService } from "../../application/workspaceService";
import { APP_EVENTS, emitAppEvent } from "../../kernel/events";
import { useWorkspacePort } from "../sdk";

export function StorageSection() {
  const { activeWorkspace } = useWorkspacePort();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState<Array<{ id: string; title: string }>>(
    [],
  );

  const refreshDeleted = useCallback(async (root: string) => {
    try {
      setDeleted(await documentService.listDeleted(root));
    } catch {
      setDeleted([]);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspace) {
      setDeleted([]);
      return;
    }
    void refreshDeleted(activeWorkspace.root);
  }, [activeWorkspace, refreshDeleted]);

  if (!activeWorkspace) {
    return <p className="settings-empty">先打开一个知识库。</p>;
  }

  const run = async (
    action: () => Promise<string | void>,
  ): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await action();
      setStatus(typeof result === "string" ? result : "操作完成。");
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="storage-settings">
      <h3>数据维护</h3>
      <p>{activeWorkspace.root}</p>
      <div className="storage-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => workspaceService.verifyDatabase(activeWorkspace.root))}
        >
          校验数据库
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(() =>
              workspaceService.backup(
                activeWorkspace.root,
                /\.note$/i.test(activeWorkspace.root),
              ),
            )
          }
        >
          创建备份
        </button>
      </div>
      {status && <p className="storage-status">{status}</p>}
      <h3>回收站</h3>
      {deleted.length === 0 ? (
        <p className="settings-empty">回收站为空。</p>
      ) : (
        <ul className="trash-list">
          {deleted.map((document) => (
            <li key={document.id}>
              <span>{document.title}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await documentService.restore(
                      activeWorkspace.root,
                      document.id,
                    );
                    await refreshDeleted(activeWorkspace.root);
                    emitAppEvent(APP_EVENTS.documentChanged);
                    return "已恢复文档。";
                  })
                }
              >
                恢复
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
