import { invoke } from "@tauri-apps/api/core";

/**
 * Single IPC boundary. Application services own command names and payloads;
 * UI code must not call invoke directly.
 */
export function command<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(name, args);
}
