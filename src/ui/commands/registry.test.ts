import { describe, expect, it } from "vitest";
import {
  executeCommand,
  findCommandForEvent,
  registerCommand,
  type CommandDefinition,
} from "./registry";

function key(
  value: string,
  options: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {},
): KeyboardEvent {
  return {
    key: value,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...options,
  } as KeyboardEvent;
}

describe("command registry", () => {
  it("matches Mod and Shift", () => {
    const command: CommandDefinition<{ ok: boolean }> = {
      id: "test.match",
      label: "match",
      shortcut: "Mod+Shift+B",
      run: () => {},
    };
    registerCommand(command);
    expect(
      findCommandForEvent(key("b", { ctrlKey: true, shiftKey: true }), {
        ok: true,
      })?.id,
    ).toBe("test.match");
    expect(
      findCommandForEvent(key("b", { ctrlKey: true }), { ok: true }),
    ).toBeUndefined();
  });

  it("does not run disabled commands", () => {
    let ran = false;
    const command: CommandDefinition<{ ready: boolean }> = {
      id: "test.disabled",
      label: "disabled",
      enabled: (context) => context.ready,
      run: () => {
        ran = true;
      },
    };
    expect(executeCommand(command, { ready: false })).toBe(false);
    expect(ran).toBe(false);
    expect(executeCommand(command, { ready: true })).toBe(true);
    expect(ran).toBe(true);
  });
});
