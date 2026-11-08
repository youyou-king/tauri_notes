import {
  alertDialog,
  confirmDialog,
  promptDialog,
} from "../../ui/dialog/appDialog";
import type { DialogPort } from "../../application/ports/dialogPort";

export function createAppDialogs(): DialogPort {
  return {
    confirm(options) {
      return confirmDialog(options);
    },

    prompt(options) {
      return promptDialog(options);
    },

    alert(message) {
      void alertDialog({ message });
    },
  };
}
