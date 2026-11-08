import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Window-level interactions stay in the shell layer. The toolbar only
 * consumes this behavior as a callback and never talks to Tauri directly.
 */
export function useWindowTitleBarDoubleClick() {
  return (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    try {
      void getCurrentWindow().toggleMaximize().catch(() => {});
    } catch {
      // Browser/E2E has no Tauri window; double click is a no-op.
    }
  };
}