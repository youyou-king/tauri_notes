import { describe, expect, it } from "vitest";
import {
  executeCommand,
  findCommandForEvent,
  getCommand,
  registerCommand,
  runCommand,
  runCommandById,
  unregisterCommand,
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

  it("unregisters plugin commands", () => {
    registerCommand({
      id: "test.unregister",
      label: "unregister",
      run: () => {},
    });
    expect(getCommand("test.unregister")).toBeDefined();
    unregisterCommand("test.unregister");
    expect(getCommand("test.unregister")).toBeUndefined();
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

  it("returns disabled results", async () => {
    const result = await runCommand(
      {
        id: "test.run-disabled",
        label: "disabled",
        enabled: () => false,
        run: () => {},
      },
      {},
    );
    expect(result).toMatchObject({
      ok: false,
      commandId: "test.run-disabled",
      error: { code: "COMMAND_DISABLED" },
    });
  });

  it("captures async command failures", async () => {
    const result = await runCommand(
      {
        id: "test.failure",
        label: "failure",
        run: async () => {
          throw new Error("存储不可用");
        },
      },
      {},
    );
    expect(result).toMatchObject({
      ok: false,
      commandId: "test.failure",
      error: { code: "COMMAND_FAILED", message: "存储不可用" },
    });
  });

  it("runs commands by id and reports missing commands", async () => {
    registerCommand({
      id: "test.run-by-id",
      label: "run by id",
      run: () => {},
    });
    expect((await runCommandById("test.run-by-id", {})).ok).toBe(true);
    expect(await runCommandById("test.missing", {})).toMatchObject({
      ok: false,
      error: { code: "COMMAND_NOT_FOUND" },
    });
    unregisterCommand("test.run-by-id");
  });
});
