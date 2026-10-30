export function commandEventName(id: string): string {
  return `command:${id}`;
}

export function dispatchCommandEvent(
  id: string,
  detail?: Record<string, unknown>,
): void {
  window.dispatchEvent(
    new CustomEvent(commandEventName(id), { detail }),
  );
}
