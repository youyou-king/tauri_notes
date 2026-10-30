import { useEffect, useRef } from "react";
import {
  dispatchIntent,
  keyboardIntent,
  registerIntentHandler,
} from "../kernel/input";

export function useAppShell({
  menuOpen,
  closeMenu,
}: {
  menuOpen: boolean;
  closeMenu: () => void;
}): void {
  const closeRef = useRef(closeMenu);
  closeRef.current = closeMenu;

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handler);
    return () => window.removeEventListener("contextmenu", handler);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        !target.closest(".toolbar-menu") &&
        !target.closest(".app-dialog-backdrop")
      ) {
        closeRef.current();
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const unregister = registerIntentHandler("cancel", () => {
      if (!menuOpen) {
        return false;
      }
      closeRef.current();
      return true;
    });
    const handler = (event: KeyboardEvent) => {
      const intent = keyboardIntent(event);
      if (intent && dispatchIntent(intent)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      unregister();
      window.removeEventListener("keydown", handler);
    };
  }, [menuOpen]);
}
