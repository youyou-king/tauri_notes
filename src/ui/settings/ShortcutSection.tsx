import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyKeymap,
  findBindingConflicts,
  listActions,
  resolveInputPlatform,
  type ActionBinding,
  type ActionDefinition,
  type KeymapDocument,
  type KeymapRecord,
} from "../../kernel/action";
import { keymapService } from "../../application/keymapService";
import { APP_EVENTS, emitAppEvent } from "../../kernel/events";

const PLATFORM = resolveInputPlatform();

function isModifierKey(key: string): boolean {
  return key === "Control" || key === "Meta" || key === "Alt" || key === "Shift";
}

function recordFor(
  action: ActionDefinition,
  key: string,
  code: string,
  event: KeyboardEvent,
): KeymapRecord {
  return {
    action: action.id,
    platform: PLATFORM,
    key,
    code,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
    scope: action.scope,
  };
}

function formatBinding(binding: ActionBinding): string {
  if (binding.kind === "surface") {
    return `移动端：${binding.surface}`;
  }
  const parts: string[] = [];
  if (binding.ctrl) {
    parts.push("Ctrl");
  }
  if (binding.meta) {
    parts.push("Cmd");
  }
  if (binding.alt) {
    parts.push("Alt");
  }
  if (binding.shift) {
    parts.push("Shift");
  }
  parts.push(binding.key || binding.code || "?");
  return parts.join(" + ");
}

function platformLabel(): string {
  return PLATFORM === "mac" ? "macOS" : "Windows / Linux";
}

export function ShortcutSection() {
  const [keymap, setKeymap] = useState<KeymapDocument | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    void keymapService.load().then((document) => {
      if (!disposed) {
        setKeymap(document);
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  const actions = listActions().filter((action) =>
    action.platforms.includes(PLATFORM),
  );
  const effective = useMemo(
    () => applyKeymap(actions, keymap),
    [actions, keymap],
  );
  const conflicts = useMemo(
    () => findBindingConflicts(effective),
    [effective],
  );

  const save = useCallback(
    async (next: KeymapDocument) => {
      setBusy(true);
      setStatus(null);
      try {
        await keymapService.save(next);
        setKeymap(next);
        emitAppEvent(APP_EVENTS.keymapChanged);
        setStatus("已保存。");
      } catch (error) {
        setStatus(String(error));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const saveBinding = useCallback(
    async (actionId: string, record: KeymapRecord | null) => {
      const current = keymap ?? { version: 2, bindings: [] };
      const bindings = current.bindings.filter(
        (item) =>
          !(item.action === actionId && item.platform === PLATFORM),
      );
      if (record) {
        bindings.push(record);
      }
      await save({ version: current.version, bindings });
      setRecording(null);
    },
    [keymap, save],
  );

  useEffect(() => {
    if (!recording || busy) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        setRecording(null);
        return;
      }
      if (isModifierKey(event.key)) {
        return;
      }
      const action = actions.find((item) => item.id === recording);
      if (!action) {
        setRecording(null);
        return;
      }
      void saveBinding(
        action.id,
        recordFor(action, event.key, event.code, event),
      );
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [actions, busy, recording, saveBinding]);

  if (!keymap) {
    return <p className="settings-empty">正在加载快捷键…</p>;
  }

  return (
    <div className="shortcut-settings">
      <h3>快捷键</h3>
      <p>
        当前平台：{platformLabel()}。点击“重设”后按下组合键；Esc 取消。
        用户覆盖保存在 `keymap.toml`。
      </p>
      {conflicts.length > 0 && (
        <p className="theme-error">
          检测到 {conflicts.length} 个绑定冲突，请调整后重试。
        </p>
      )}
      <div className="shortcut-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save({ version: 2, bindings: [] })}
        >
          恢复默认快捷键
        </button>
      </div>
      <ul className="shortcut-list">
        {effective.map((action) => {
          const bindings = action.defaultBindings.filter(
            (binding) => binding.kind === "key" && binding.platform === PLATFORM,
          );
          return (
            <li key={action.id} className="shortcut-row">
              <span className="shortcut-title">
                <strong>{action.title}</strong>
                <small>{action.id}</small>
              </span>
              <span className="shortcut-keys">
                {bindings.length === 0
                  ? "未绑定"
                  : bindings.map(formatBinding).join(" / ")}
              </span>
              <button
                type="button"
                disabled={busy}
                className={recording === action.id ? "active" : ""}
                onClick={() =>
                  setRecording(recording === action.id ? null : action.id)
                }
              >
                {recording === action.id ? "按下组合键…" : "重设"}
              </button>
            </li>
          );
        })}
      </ul>
      {status && <p className="storage-status">{status}</p>}
    </div>
  );
}