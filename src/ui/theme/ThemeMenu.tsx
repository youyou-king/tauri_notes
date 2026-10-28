import { useRef, useState, type ChangeEvent } from "react";
import { useTheme, type ThemeManifest } from "./ThemeProvider";
import { ThemeEditor } from "./ThemeEditor";

const BUILT_INS: Array<[ "dark" | "light" | "system", string]> = [
  ["dark", "深色"],
  ["light", "浅色"],
  ["system", "跟随系统"],
];

export function ThemeMenu({ onClose }: { onClose: () => void }) {
  const {
    mode,
    customThemes,
    setMode,
    importTheme,
    removeTheme,
    exportTheme,
  } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ThemeManifest | undefined>();

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const result = importTheme(await file.text());
    if (!result.ok) {
      setError(result.error ?? "导入失败");
      return;
    }
    setError(null);
    onClose();
  }

  function downloadTheme(id: string) {
    const json = exportTheme(id);
    if (!json) {
      return;
    }
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${id}.theme.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="toolbar-popover theme-popover">
      {BUILT_INS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={mode === value ? "active" : ""}
          onClick={() => {
            setMode(value);
            onClose();
          }}
        >
          {label}
        </button>
      ))}

      {customThemes.length > 0 && (
        <div className="theme-group-label">自定义主题</div>
      )}
      {customThemes.map((theme) => (
        <div className="theme-row" key={theme.id}>
          <button
            type="button"
            className={mode === `custom:${theme.id}` ? "active" : ""}
            onClick={() => {
              setMode(`custom:${theme.id}`);
              onClose();
            }}
          >
            {theme.name}
          </button>
          <button
            type="button"
            className="theme-delete"
            title="编辑主题"
            onClick={() => {
              setEditing(theme);
              setEditorOpen(true);
            }}
          >
            ✎
          </button>
          <button
            type="button"
            className="theme-delete"
            title="导出主题"
            onClick={() => downloadTheme(theme.id)}
          >
            ↓
          </button>
          <button
            type="button"
            className="theme-delete"
            title="删除主题"
            onClick={() => removeTheme(theme.id)}
          >
            ×
          </button>
        </div>
      ))}

      <div className="theme-divider" />
      <button
        type="button"
        onClick={() => {
          setEditing(undefined);
          setEditorOpen(true);
        }}
      >
        新建主题…
      </button>
      <button type="button" onClick={() => fileRef.current?.click()}>
        导入主题…
      </button>
      <input
        ref={fileRef}
        className="theme-file-input"
        type="file"
        accept=".json,application/json"
        onChange={(event) => void onFile(event)}
      />
      {error && <div className="theme-error">{error}</div>}
      {editorOpen && (
        <ThemeEditor
          initial={editing}
          onClose={() => {
            setEditorOpen(false);
            setEditing(undefined);
            onClose();
          }}
        />
      )}
    </div>
  );
}
