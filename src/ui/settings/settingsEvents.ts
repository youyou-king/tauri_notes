import { APP_EVENTS } from "../../kernel/events";
import { shellActions } from "../shell/shellActions";

export const SETTINGS_OPEN_EVENT = APP_EVENTS.settingsOpen;

/**
 * Settings is a shell capability, not a feature of the theme plugin. Any
 * shell entry point or plugin can request the shared settings host.
 */
export function openSettings(): void {
  shellActions.openSettings();
}
