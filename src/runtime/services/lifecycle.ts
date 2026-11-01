import { listen } from "@tauri-apps/api/event";
import type { LifecyclePort } from "../../application/ports/lifecyclePort";

/**
 * WebView lifecycle adapter. visibilitychange is the portable signal for
 * mobile backgrounding; pagehide covers desktop window teardown.
 */
export function createWebLifecycle(): LifecyclePort {
  return {
    onBackground(handler) {
      let disposed = false;
      let unlistenTauri: (() => void) | null = null;
      void listen("tauri://paused", () => handler())
        .then((unlisten) => {
          if (disposed) {
            unlisten();
          } else {
            unlistenTauri = unlisten;
          }
        })
        .catch(() => {
          // Browser/E2E has no Tauri event bridge; WebView signals still work.
        });
      const onVisibility = () => {
        if (document.visibilityState === "hidden") {
          handler();
        }
      };
      const onPageHide = () => handler();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", onPageHide);
      return () => {
        disposed = true;
        unlistenTauri?.();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", onPageHide);
      };
    },
  };
}