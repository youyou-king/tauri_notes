import { useState } from "react";
import { workspaceService } from "../../application/workspaceService";
import { useWorkspacePort } from "../sdk";

export function StorageSection() {
  const { activeWorkspace } = useWorkspacePort();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    </div>
  );
}
