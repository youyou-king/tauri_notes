import { useState } from "react";
import {
  readDisabledPlugins,
  setPluginDisabled,
  usePluginEntries,
  usePluginFailures,
} from "../sdk";

export function PluginManagerSection() {
  const entries = usePluginEntries();
  const failures = usePluginFailures();
  const [disabled, setDisabled] = useState(
    () => readDisabledPlugins(),
  );
  const [dirty, setDirty] = useState(false);

  const toggle = (id: string, next: boolean) => {
    setPluginDisabled(id, next);
    setDisabled((current) => {
      const updated = new Set(current);
      if (next) {
        updated.add(id);
      } else {
        updated.delete(id);
      }
      return updated;
    });
    setDirty(true);
  };

  return (
    <div className="plugin-manager">
      <p>
        禁用插件会在下次启动时移除其面板、命令和设置。功能插件被禁用后，
        对应入口会消失，数据仍保留。
      </p>
      {failures.length > 0 && (
        <ul className="plugin-failures" aria-label="插件启动失败">
          {failures.map((failure) => (
            <li key={failure.pluginId}>
              <strong>{failure.pluginId}</strong>
              <span>{failure.message}</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="plugin-manager-list">
        {entries.map((entry) => {
          const manifest = entry.manifest;
          return (
            <li key={manifest.id}>
              <div>
                <strong>{manifest.name}</strong>
                <span>
                  {manifest.id} · {manifest.kind}
                </span>
                {manifest.capabilities.length > 0 && (
                  <span>{manifest.capabilities.join(" · ")}</span>
                )}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={!disabled.has(manifest.id)}
                  onChange={(event) =>
                    toggle(manifest.id, !event.target.checked)
                  }
                />
                启用
              </label>
            </li>
          );
        })}
      </ul>
      {dirty && (
        <div className="theme-pack-actions">
          <button
            type="button"
            className="primary"
            onClick={() => window.location.reload()}
          >
            重新加载以应用
          </button>
        </div>
      )}
    </div>
  );
}
