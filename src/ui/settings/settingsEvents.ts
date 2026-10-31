import { APP_EVENTS, emitAppEvent } from "../../kernel/events";

export const SETTINGS_OPEN_EVENT = APP_EVENTS.settingsOpen;

/**
 * Settings is a shell capability, not a feature of the theme plugin. Any
 * shell entry point or plugin can request the shared settings host.
 */
export function openSettings(): void {
  emitAppEvent(APP_EVENTS.settingsOpen);
}
