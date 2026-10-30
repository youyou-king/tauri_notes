import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export type CommandContext = Record<string, unknown>;

export type CommandDefinition<TContext = CommandContext> = {
  id: string;
  label: string;
  shortcut?: string;
  enabled?: (context: TContext) => boolean;
  run: (context: TContext) => void | Promise<void>;
};

export type CommandFailure = {
  code:
    | "COMMAND_DISABLED"
    | "COMMAND_FAILED"
    | "COMMAND_CANCELLED"
    | "COMMAND_NOT_FOUND";
  message: string;
};

export type CommandResult =
  | { ok: true; commandId: string }
  | { ok: false; commandId: string; error: CommandFailure };

const commands = new Map<string, CommandDefinition<any>>();

export function registerCommand<TContext>(
  definition: CommandDefinition<TContext>,
): void {
  commands.set(
    definition.id,
    definition,
  );
}

export function unregisterCommand(id: string): void {
  commands.delete(id);
}

export function getCommand(
  id: string,
): CommandDefinition<any> | undefined {
  return commands.get(id);
}

export function listCommands(): CommandDefinition<any>[] {
  return [...commands.values()];
}

export async function runCommand<TContext>(
  command: CommandDefinition<TContext>,
  context: TContext,
): Promise<CommandResult> {
  if (command.enabled && !command.enabled(context)) {
    return {
      ok: false,
      commandId: command.id,
      error: {
        code: "COMMAND_DISABLED",
        message: `命令“${command.label}”当前不可用`,
      },
    };
  }
  try {
    await command.run(context);
    return { ok: true, commandId: command.id };
  } catch (error) {
    const cancelled =
      error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      commandId: command.id,
      error: {
        code: cancelled ? "COMMAND_CANCELLED" : "COMMAND_FAILED",
        message:
          error instanceof Error
            ? error.message
            : `命令“${command.label}”执行失败`,
      },
    };
  }
}

export async function runCommandById<TContext>(
  id: string,
  context: TContext,
): Promise<CommandResult> {
  const command = getCommand(id);
  if (!command) {
    return {
      ok: false,
      commandId: id,
      error: {
        code: "COMMAND_NOT_FOUND",
        message: `命令“${id}”不存在`,
      },
    };
  }
  return runCommand(command as CommandDefinition<TContext>, context);
}

export function executeCommand<TContext>(
  command: CommandDefinition<TContext>,
  context: TContext,
): boolean {
  if (command.enabled && !command.enabled(context)) {
    return false;
  }
  void runCommand(command, context);
  return true;
}

function matchesShortcut(
  event: KeyboardEvent | ReactKeyboardEvent,
  shortcut: string,
): boolean {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) {
    return false;
  }
  const key = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1));
  const mod = event.ctrlKey || event.metaKey;

  if (modifiers.has("mod") !== mod) {
    return false;
  }
  if (modifiers.has("shift") !== event.shiftKey) {
    return false;
  }
  if (modifiers.has("alt") !== event.altKey) {
    return false;
  }
  return event.key.toLowerCase() === key;
}

/**
 * Finds the first enabled command matching the keyboard event. Context is
 * supplied by the caller because command handlers must not import UI state.
 */
export function findCommandForEvent<TContext>(
  event: KeyboardEvent | ReactKeyboardEvent,
  context: TContext,
): CommandDefinition<TContext> | undefined {
  for (const command of commands.values()) {
    if (!command.shortcut || !matchesShortcut(event, command.shortcut)) {
      continue;
    }
    if (command.enabled && !command.enabled(context)) {
      continue;
    }
    return command as CommandDefinition<TContext>;
  }
  return undefined;
}
