import { useEffect, useRef } from "react";
import type { ThemeManifest, ThemeSelection } from "./themeSchema";
import type { ResolvedTheme } from "./ThemeProvider";

/**
 * ThemeProvider owns the base token layer. While an appearance pack is active,
 * the pack owns the overlay layer and this hook intentionally does nothing.
 */
export function useBaseThemeTokens(
  activeCustom: ThemeManifest | undefined,
  appearanceActive: boolean,
  mode: ThemeSelection,
  resolved: ResolvedTheme,
): void {
  const appliedTokens = useRef<string[]>([]);

  useEffect(() => {
    if (appearanceActive) {
      return;
    }
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
  }, [activeCustom, appearanceActive, mode, resolved]);
}
