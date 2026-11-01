import { confirmDialog } from "../../ui/dialog/confirmDialog";
import type { DialogPort } from "../../application/ports/dialogPort";

function createTauriDialogs(): DialogPort {
  return {
    confirm(options) {
      return confirmDialog(options);
    },

    prompt(options) {
      return Promise.resolve(
        window.prompt(options.title, options.defaultValue ?? ""),
      );
    },

    alert(message) {
      window.alert(message);
    },
  };
}

export function createDesktopDialogs(): DialogPort {
  return createTauriDialogs();
}

/**
 * Same behavior for now; the mobile Shell can swap in a bottom-sheet prompt
 * without touching callers.
 */
export function createMobileDialogs(): DialogPort {
  return createTauriDialogs();
}