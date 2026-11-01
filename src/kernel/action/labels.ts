import type {
  ActionBinding,
  ActionDefinition,
  InputPlatform,
} from "./types";

export function formatBinding(binding: ActionBinding): string {
  if (binding.kind === "surface") {
    return `移动端：${binding.surface}`;
  }
  const parts: string[] = [];
  if (binding.ctrl) {
    parts.push("Ctrl");
  }
  if (binding.meta) {
    parts.push("Cmd");
  }
  if (binding.alt) {
    parts.push("Alt");
  }
  if (binding.shift) {
    parts.push("Shift");
  }
  parts.push(binding.key || binding.code || "?");
  return parts.join(" + ");
}

export function shortcutForAction(
  action: ActionDefinition | undefined,
  platform: InputPlatform,
): string | undefined {
  const binding = action?.defaultBindings.find(
    (candidate) =>
      candidate.kind === "key" && candidate.platform === platform,
  );
  return binding ? formatBinding(binding) : undefined;
}

