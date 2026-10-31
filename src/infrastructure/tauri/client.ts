import { invoke } from "@tauri-apps/api/core";

export type CommandErrorCode =
  | "COMMAND_DENIED"
  | "COMMAND_NOT_FOUND"
  | "COMMAND_FAILED";

/**
 * Structured IPC failure. The Rust side returns strings today, so this
 * boundary classifies them once instead of every UI caller parsing messages.
 */
export class TauriCommandError extends Error {
  readonly code: CommandErrorCode;
  readonly commandName: string;

  constructor(code: CommandErrorCode, commandName: string, message: string) {
    super(message);
    this.name = "TauriCommandError";
    this.code = code;
    this.commandName = commandName;
  }
}

function classify(message: string): CommandErrorCode {
  if (/access denied|permission|拒绝访问|权限|not allowed/i.test(message)) {
    return "COMMAND_DENIED";
  }
  if (/not found|不存在|未找到/i.test(message)) {
    return "COMMAND_NOT_FOUND";
  }
  return "COMMAND_FAILED";
}

const KNOWN_CODES: readonly CommandErrorCode[] = [
  "COMMAND_DENIED",
  "COMMAND_NOT_FOUND",
  "COMMAND_FAILED",
];

export function toTauriCommandError(
  error: unknown,
  commandName: string,
): TauriCommandError {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const record = error as { code?: unknown; message: string };
    const code = KNOWN_CODES.includes(record.code as CommandErrorCode)
      ? (record.code as CommandErrorCode)
      : classify(record.message);
    return new TauriCommandError(code, commandName, record.message);
  }
  const message =
    error instanceof Error ? error.message : String(error);
  return new TauriCommandError(
    classify(message),
    commandName,
    message,
  );
}

/**
 * Single IPC boundary. Application services own command names and payloads;
 * UI code must not call invoke directly.
 */
export async function command<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (error) {
    throw toTauriCommandError(error, name);
  }
}
