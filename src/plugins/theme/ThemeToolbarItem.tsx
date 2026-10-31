import { useEffect } from "react";
import { ToolbarMenu } from "../../ui/sdk";
import { restoreAppliedAppearance } from "./appearanceApplier";
import { ThemeMenu } from "./ui/ThemeMenu";

export function ThemeToolbarItem() {
  useEffect(() => {
    // ThemeProvider effects run after plugin effects; restore in a later task
    // so the appearance pack is applied on top of provider tokens.
    void Promise.resolve().then(restoreAppliedAppearance);
  }, []);

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
            window.dispatchEvent(new CustomEvent("settings:open"));
          }}
        />
      )}
    </ToolbarMenu>
  );
}
