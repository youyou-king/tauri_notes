export type ThemeSelection =
  | "dark"
  | "light"
  | "system"
  | `custom:${string}`;

export type ThemeMode = ThemeSelection;

export type ThemeManifest = {
  schema: 1;
  id: string;
  name: string;
  base: "dark" | "light";
  tokens: Record<string, string>;
};

export const CUSTOM_THEMES_KEY = "tauri-notes.custom-themes.v1";

const TOKEN_NAME = /^--[a-z0-9][a-z0-9-]{0,63}$/;
const THEME_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;

function isSafeTokenValue(value: string): boolean {
  if (value.length === 0 || value.length > 240) {
    return false;
  }
  // Themes can only provide CSS values, never selectors, URLs or scripts.
  return !/url\s*\(|@import|javascript:|expression\s*\(|[;{}]/i.test(value);
}

export function parseThemeManifest(raw: unknown): {
  theme?: ThemeManifest;
  error?: string;
} {
  if (!raw || typeof raw !== "object") {
    return { error: "主题文件必须是 JSON 对象" };
  }
  const source = raw as Record<string, unknown>;
  if (source.schema !== 1) {
    return { error: "不支持的 schema，当前只支持 1" };
  }
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  if (!THEME_ID.test(id)) {
    return { error: "id 只能包含小写字母、数字和连字符" };
  }
  if (!name || name.length > 60) {
    return { error: "name 必须为 1-60 个字符" };
  }
  if (source.base !== "dark" && source.base !== "light") {
    return { error: "base 必须是 dark 或 light" };
  }
  if (
    !source.tokens ||
    typeof source.tokens !== "object" ||
    Array.isArray(source.tokens)
  ) {
    return { error: "tokens 必须是对象" };
  }
  const entries = Object.entries(source.tokens as Record<string, unknown>);
  if (entries.length > 100) {
    return { error: "tokens 数量不能超过 100" };
  }
  const tokens: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!TOKEN_NAME.test(key)) {
      return { error: `非法 token 名：${key}` };
    }
    if (typeof value !== "string" || !isSafeTokenValue(value)) {
      return { error: `token ${key} 的值不安全` };
    }
    tokens[key] = value;
  }
  return {
    theme: {
      schema: 1,
      id,
      name,
      base: source.base,
      tokens,
    },
  };
}

export function loadCustomThemes(): ThemeManifest[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      const result = parseThemeManifest(item);
      return result.theme ? [result.theme] : [];
    });
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: ThemeManifest[]): void {
  window.localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}
