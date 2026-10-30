import { useCallback, useEffect, useState } from "react";
import { createPluginServices } from "../../../application/pluginServices";
import { useWorkspacePort } from "../../../ui/sdk";
import { referenceFeature } from "../manifest";

const pluginServices = createPluginServices(referenceFeature);

export function ReferenceSettingsSection() {
  const { activeWorkspace } = useWorkspacePort();
  const workspaceRoot = activeWorkspace?.root ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceRoot) {
      setCount(null);
      return;
    }
    setLoading(true);
    try {
      const targets = await pluginServices.reference.listTargets(
        workspaceRoot,
      );
      setCount(targets.length);
      setError(null);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, [workspaceRoot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="reference-settings">
      <p>
        引用目标来自当前工作区已索引的文档块。选择内容插入视图时，会从这些目标中检索引用。
      </p>
      {workspaceRoot ? (
        <p>
          当前可引用目标：{count === null ? "读取中…" : `${count} 条`}
        </p>
      ) : (
        <p>尚未打开知识库。</p>
      )}
      {error && <p className="theme-error">{error}</p>}
      <button
        type="button"
        className="primary"
        onClick={() => void refresh()}
        disabled={!workspaceRoot || loading}
      >
        {loading ? "刷新中…" : "刷新引用目标"}
      </button>
    </div>
  );
}
