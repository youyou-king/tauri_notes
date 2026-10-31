import { APP_EVENTS, emitAppEvent } from "../../kernel/events";

/**
 * Shell capabilities are the only cross-shell entry points for opening
 * settings, search, help, board and theme surfaces. Desktop and mobile shells
 * call the same actions; plugins reach them through ui/sdk.
 */
export const shellActions = {
  openSettings(): void {
    emitAppEvent(APP_EVENTS.settingsOpen);
  },
  openSearch(): void {
    emitAppEvent(APP_EVENTS.searchOpen);
  },
  openHelp(): void {
    emitAppEvent(APP_EVENTS.helpOpen);
  },
  openBoard(): void {
    emitAppEvent(APP_EVENTS.boardOpen);
  },
  openTheme(): void {
    emitAppEvent(APP_EVENTS.themeOpen);
  },
} as const;
