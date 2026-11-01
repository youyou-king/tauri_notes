import type { LifecyclePort } from "../../application/ports/lifecyclePort";

/**
 * WebView lifecycle adapter. visibilitychange is the portable signal for
 * mobile backgrounding; pagehide covers desktop window teardown.
 */
export function createWebLifecycle(): LifecyclePort {
  return {
    onBackground(handler) {
      const onVisibility = () => {
        if (document.visibilityState === "hidden") {
          handler();
        }
      };
      const onPageHide = () => handler();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", onPageHide);
      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", onPageHide);
      };
    },
  };
}