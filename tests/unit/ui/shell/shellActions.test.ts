import { describe, expect, it, vi } from "vitest";
import { APP_EVENTS, onAppEvent } from "../../../../src/kernel/events";
import { shellActions } from "../../../../src/ui/shell/shellActions";

describe("shellActions", () => {
  it.each([
    ["openSettings", APP_EVENTS.settingsOpen],
    ["openSearch", APP_EVENTS.searchOpen],
    ["openHelp", APP_EVENTS.helpOpen],
    ["openBoard", APP_EVENTS.boardOpen],
    ["openTheme", APP_EVENTS.themeOpen],
  ] as const)("%s emits the matching typed event", (action, event) => {
    const handler = vi.fn();
    const off = onAppEvent(event, handler);
    shellActions[action]();
    expect(handler).toHaveBeenCalledOnce();
    off();
  });
});
