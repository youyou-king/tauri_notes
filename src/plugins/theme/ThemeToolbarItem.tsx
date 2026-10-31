import { useEffect } from "react";
import { openSettings, ToolbarMenu, useTheme } from "../../ui/sdk";
import { restoreAppliedAppearance } from "./appearanceApplier";
import {
  restoreAppearanceRuntime,
  syncAppearanceMode,
} from "./appearanceRuntime";
import { ThemeMenu } from "./ui/ThemeMenu";

export function ThemeToolbarItem() {
  const { resolved } = useTheme();

  useEffect(() => {
    let cancelled = false;
    // ThemeProvider effects run after plugin effects; restore in a later task
    // so the appearance pack is applied on top of provider tokens.
    void Promise.resolve().then(async () => {
      const restored = await restoreAppearanceRuntime(resolved);
      if (!cancelled && !restored) {
        await restoreAppliedAppearance();
      }
    });
    return () => {
      cancelled = true;
    };
    // Restore once with the mode that was active at mount. Later changes are
    // handled by the resolved-mode effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void syncAppearanceMode(resolved);
  }, [resolved]);

  return (
    <ToolbarMenu
      id="theme"
      label="主题"
      openEvent="theme:open"
      closeOnSelect={false}
    >
      {(close) => (
        <ThemeMenu
          embedded
          onClose={close}
          onOpenSettings={() => {
            close();
            openSettings();
          }}
        />
      )}
    </ToolbarMenu>
  );
}
