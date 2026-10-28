import { useState } from "react";
import { useTheme, type ThemeManifest } from "./ThemeProvider";

const DEFAULTS: Record<string, string> = {
  "--bg": "#111318",
  "--bg-panel": "#171a21",
  "--bg-elevated": "#1e222b",
  "--bg-hover": "#262c38",
  "--border": "#2a2f3a",
  "--text": "#e8eaf0",
  "--muted": "#8b93a3",
  "--accent": "#7aa2ff",
  "--map-canvas-bg": "#0f1218",
  "--map-node-bg": "#171c26",
  "--map-node-text": "#dbe2ef",
  "--map-node-border": "#344056",
};

const LIGHT_DEFAULTS: Record<string, string> = {
  "--bg": "#f2f2ef",
  "--bg-panel": "#fbfbfa",
  "--bg-elevated": "#ffffff",
  "--bg-hover": "#ecece8",
  "--border": "#e5e5e0",
  "--text": "#292924",
  "--muted": "#74746d",
  "--accent": "#4d6bfe",
  "--map-canvas-bg": "#f8f8f5",
  "--map-node-bg": "#ffffff",
  "--map-node-text": "#24241f",
  "--map-node-border": "#deded7",
};

function defaultsFor(base: "dark" | "light"): Record<string, string> {
  return base === "light" ? LIGHT_DEFAULTS : DEFAULTS;
}

const FIELDS: Array<{ key: string; label: string }> = [
  { key: "--bg", label: "应用背景" },
  { key: "--bg-panel", label: "面板背景" },
  { key: "--bg-elevated", label: "浮层背景" },
  { key: "--bg-hover", label: "悬停背景" },
  { key: "--border", label: "边框" },
  { key: "--text", label: "正文文字" },
  { key: "--muted", label: "次要文字" },
  { key: "--accent", label: "强调色" },
  { key: "--map-canvas-bg", label: "导图画布" },
  { key: "--map-node-bg", label: "导图节点" },
  { key: "--map-node-text", label: "导图文字" },
  { key: "--map-node-border", label: "导图边框" },
];

function toHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return "#000000";
}

function slug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `theme-${Date.now().toString(36)}`;
}

export function ThemeEditor({
  initial,
  onClose,
}: {
  initial?: ThemeManifest;
  onClose: () => void;
}) {
  const { importTheme, resolved } = useTheme();
  const initialBase = initial?.base ?? resolved;
  const [name, setName] = useState(initial?.name ?? "我的主题");
  const [base, setBase] = useState<"dark" | "light">(initialBase);
  const [tokens, setTokens] = useState<Record<string, string>>({
    ...defaultsFor(initialBase),
    ...(initial?.tokens ?? {}),
  });
  const [error, setError] = useState<string | null>(null);

  function update(key: string, value: string) {
    setTokens((current) => ({ ...current, [key]: value }));
  }

  function save() {
    const manifest: ThemeManifest = {
      schema: 1,
      id: initial?.id ?? slug(name),
      name: name.trim(),
      base,
      tokens,
    };
    const result = importTheme(JSON.stringify(manifest));
    if (!result.ok) {
      setError(result.error ?? "保存失败");
      return;
    }
    onClose();
  }

  return (
    <div
      className="theme-editor-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="theme-editor" data-part="theme-editor">
        <header>
          <div>
            <h2>{initial ? "编辑主题" : "新建主题"}</h2>
            <p>只改变颜色，不影响布局和功能。</p>
          </div>
          <button type="button" onClick={onClose} title="关闭">
            ×
          </button>
        </header>

        <div className="theme-editor-body">
          <div className="theme-editor-fields">
            <label>
              主题名称
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              基础模式
              <select
                value={base}
                onChange={(event) => {
                  const next = event.target.value as "dark" | "light";
                  setBase(next);
                  if (!initial) {
                    setTokens({ ...defaultsFor(next) });
                  }
                }}
              >
                <option value="dark">深色</option>
                <option value="light">浅色</option>
              </select>
            </label>
            {FIELDS.map((field) => (
              <label key={field.key} className="theme-color-field">
                {field.label}
                <input
                  type="color"
                  value={toHex(
                    tokens[field.key] ?? defaultsFor(base)[field.key],
                  )}
                  onChange={(event) =>
                    update(field.key, event.target.value)
                  }
                />
              </label>
            ))}
            {error && <div className="theme-error">{error}</div>}
          </div>

          <div
            className="theme-preview"
            style={{
              background: tokens["--bg"],
              color: tokens["--text"],
              borderColor: tokens["--border"],
            }}
          >
            <div
              className="theme-preview-panel"
              style={{
                background: tokens["--bg-panel"],
                borderColor: tokens["--border"],
              }}
            >
              <div
                className="theme-preview-tab"
                style={{ color: tokens["--accent"] }}
              >
                知识库
              </div>
              <div
                className="theme-preview-node"
                style={{
                  background: tokens["--map-node-bg"],
                  color: tokens["--map-node-text"],
                  borderColor: tokens["--map-node-border"],
                }}
              >
                主题预览
              </div>
              <div style={{ color: tokens["--muted"] }}>
                次要文字 · 边框 · 强调色
              </div>
            </div>
          </div>
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary" onClick={save}>
            保存并应用
          </button>
        </footer>
      </section>
    </div>
  );
}
