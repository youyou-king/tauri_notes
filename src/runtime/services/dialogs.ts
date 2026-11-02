import { confirmDialog } from "../../ui/dialog/confirmDialog";
import {
  createMobileAlert,
  createMobileConfirm,
  createMobilePrompt,
} from "../../ui/mobile/mobileDialogs";
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
 * Mobile WebViews do not implement `window.prompt`/`window.confirm`
 * consistently. Use the compact DOM dialog adapter instead.
 */
export function createMobileDialogs(): DialogPort {
  return {
    confirm: createMobileConfirm,
    prompt: createMobilePrompt,
    alert: createMobileAlert,
  };
}