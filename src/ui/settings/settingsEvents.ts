export const SETTINGS_OPEN_EVENT = "settings:open";

/**
 * Settings is a shell capability, not a feature of the theme plugin. Any
 * shell entry point or plugin can request the shared settings host.
 */
export function openSettings(): void {
  window.dispatchEvent(new CustomEvent(SETTINGS_OPEN_EVENT));
}
