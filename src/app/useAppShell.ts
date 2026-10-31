import { useEffect } from "react";
import { dispatchIntent, keyboardIntent } from "../kernel/input";

export function useAppShell(): void {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handler);
    return () => window.removeEventListener("contextmenu", handler);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const intent = keyboardIntent(event);
      if (intent && dispatchIntent(intent)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
