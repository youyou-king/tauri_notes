import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadCustomThemes,
  parseThemeManifest,
  saveCustomThemes,
  type ThemeManifest,
  type ThemeMode,
  type ThemeSelection,
} from "./themeSchema";
import { themeRepository } from "../../infrastructure/tauri/themeRepository";

export type { ThemeManifest, ThemeMode, ThemeSelection };

export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "tauri-notes.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  mode: ThemeSelection;
  resolved: ResolvedTheme;
  customThemes: ThemeManifest[];
  setMode: (mode: ThemeSelection) => void;
  importTheme: (raw: string) => { ok: boolean; error?: string };
  removeTheme: (id: string) => void;
  exportTheme: (id: string) => string | null;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSelection(): ThemeSelection {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "system" || stored === "dark") {
    return stored;
  }
  if (stored?.startsWith("custom:")) {
    return stored as ThemeSelection;
  }
  return "dark";
}

function resolveBase(
  selection: ThemeSelection,
  customThemes: ThemeManifest[],
  systemDark: boolean,
): ResolvedTheme {
  if (selection.startsWith("custom:")) {
    return (
      customThemes.find((theme) => `custom:${theme.id}` === selection)?.base ??
      "dark"
    );
  }
  if (selection === "system") {
    return systemDark ? "dark" : "light";
  }
  return selection === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeSelection>(readSelection);
  const [customThemes, setCustomThemes] =
    useState<ThemeManifest[]>(loadCustomThemes);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  );
  const appliedTokens = useRef<string[]>([]);

  const activeCustom = mode.startsWith("custom:")
    ? customThemes.find((theme) => `custom:${theme.id}` === mode)
    : undefined;
  const resolved = resolveBase(mode, customThemes, systemDark);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const handler = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void themeRepository
      .list()
      .then((rawThemes) => {
        if (cancelled) {
          return;
        }
        const fromFiles = rawThemes.flatMap((raw) => {
          try {
            const result = parseThemeManifest(JSON.parse(raw));
            return result.theme ? [result.theme] : [];
          } catch {
            return [];
          }
        });
        const merged = new Map(
          loadCustomThemes().map((theme) => [theme.id, theme]),
        );
        for (const theme of fromFiles) {
          merged.set(theme.id, theme);
        }
        const next = [...merged.values()];
        setCustomThemes(next);
        saveCustomThemes(next);
        const fileIds = new Set(fromFiles.map((theme) => theme.id));
        for (const theme of next) {
          if (!fileIds.has(theme.id)) {
            void themeRepository
              .save(theme.id, JSON.stringify(theme))
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        // Browser/dev builds may not expose app-data commands.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode.startsWith("custom:") && !activeCustom) {
      setModeState("dark");
      window.localStorage.setItem(STORAGE_KEY, "dark");
    }
  }, [activeCustom, mode]);

  useEffect(() => {
    const root = document.documentElement;
    for (const token of appliedTokens.current) {
      root.style.removeProperty(token);
    }
    appliedTokens.current = [];

    if (activeCustom) {
      for (const [token, value] of Object.entries(activeCustom.tokens)) {
        root.style.setProperty(token, value);
        appliedTokens.current.push(token);
      }
      root.dataset.theme = activeCustom.base;
      root.dataset.themeMode = mode;
      return;
    }

    root.dataset.theme = resolved;
    root.dataset.themeMode = mode;
  }, [activeCustom, mode, resolved]);

  const setMode = useCallback((next: ThemeSelection) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const importTheme = useCallback((raw: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "不是有效的 JSON 文件" };
    }
    const result = parseThemeManifest(parsed);
    if (!result.theme) {
      return { ok: false, error: result.error };
    }
    const theme = result.theme;
    let next: ThemeManifest[] = [];
    setCustomThemes((current) => {
      const exists = current.some((item) => item.id === theme.id);
      next = exists
        ? current.map((item) => (item.id === theme.id ? theme : item))
        : [...current, theme];
      saveCustomThemes(next);
      return next;
    });
    setMode(`custom:${theme.id}`);
    void themeRepository
      .save(theme.id, JSON.stringify(theme))
      .catch(() => {});
    return { ok: true };
  }, [setMode]);

  const removeTheme = useCallback(
    (id: string) => {
      setCustomThemes((current) => {
        const next = current.filter((theme) => theme.id !== id);
        saveCustomThemes(next);
        return next;
      });
      if (mode === `custom:${id}`) {
        setMode("dark");
      }
      void themeRepository.delete(id).catch(() => {});
    },
    [mode, setMode],
  );

  const exportTheme = useCallback(
    (id: string) => {
      const theme = customThemes.find((item) => item.id === id);
      return theme ? JSON.stringify(theme, null, 2) : null;
    },
    [customThemes],
  );

  const value = useMemo(
    () => ({
      mode,
      resolved,
      customThemes,
      setMode,
      importTheme,
      removeTheme,
      exportTheme,
    }),
    [
      mode,
      resolved,
      customThemes,
      setMode,
      importTheme,
      removeTheme,
      exportTheme,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}
