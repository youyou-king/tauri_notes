import type {
  ActionBinding,
  ActionDefinition,
  BindingConflict,
  InputPlatform,
} from "./types";

const actions = new Map<string, ActionDefinition>();

export function registerAction(definition: ActionDefinition): void {
  actions.set(definition.id, definition);
}

export function unregisterAction(id: string): void {
  actions.delete(id);
}

export function getAction(id: string): ActionDefinition | undefined {
  return actions.get(id);
}

export function listActions(): ActionDefinition[] {
  return [...actions.values()];
}

export function clearActionsForTests(): void {
  actions.clear();
}

function bindingKey(binding: ActionBinding): string {
  const scope = binding.scope ?? "global";
  if (binding.kind === "surface") {
    return [
      "surface",
      binding.platform,
      scope,
      binding.surface,
    ].join("|");
  }
  return [
    "key",
    binding.platform,
    scope,
    binding.ctrl ? "ctrl" : "",
    binding.meta ? "meta" : "",
    binding.alt ? "alt" : "",
    binding.shift ? "shift" : "",
    binding.code ?? binding.key.toLowerCase(),
  ].join("|");
}

/**
 * Returns every binding that is claimed by more than one action. The registry
 * does not silently drop collisions: callers can report them in settings or
 * fail a development assertion.
 */
export function findBindingConflicts(
  definitions: ActionDefinition[] = listActions(),
): BindingConflict[] {
  const claims = new Map<string, Set<string>>();
  for (const action of definitions) {
    for (const binding of action.defaultBindings) {
      const key = bindingKey(binding);
      const bucket = claims.get(key) ?? new Set<string>();
      bucket.add(action.id);
      claims.set(key, bucket);
    }
  }
  const conflicts: BindingConflict[] = [];
  for (const action of definitions) {
    for (const binding of action.defaultBindings) {
      const actionIds = [...(claims.get(bindingKey(binding)) ?? [])];
      if (actionIds.length > 1) {
        conflicts.push({ binding, actionIds });
      }
    }
  }
  return conflicts;
}

export function bindingsForPlatform(
  platform: InputPlatform,
  definitions: ActionDefinition[] = listActions(),
): Array<{ action: ActionDefinition; binding: ActionBinding }> {
  const result: Array<{
    action: ActionDefinition;
    binding: ActionBinding;
  }> = [];
  for (const action of definitions) {
    if (!action.platforms.includes(platform)) {
      continue;
    }
    for (const binding of action.defaultBindings) {
      if (binding.platform === platform) {
        result.push({ action, binding });
      }
    }
  }
  return result;
}