import type {
  ActionBinding,
  ActionDefinition,
  ActionRuntime,
  ActionScope,
  InputPlatform,
  KeyBinding,
} from "./types";
import { bindingsForPlatform } from "./registry";

type KeyboardLike = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
  repeat?: boolean;
  defaultPrevented?: boolean;
  target: EventTarget | null;
  preventDefault?: () => void;
};

export type InputRouterOptions = {
  platform: InputPlatform;
  actions: ActionDefinition[];
  bindings?: Array<{ action: ActionDefinition; binding: ActionBinding }>;
};

export type InputRouterRuntime = {
  hasWorkspace: boolean;
  runCommand: (id: string) => void;
};

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable='']",
    ),
  );
}

function sameModifiers(event: KeyboardLike, binding: KeyBinding): boolean {
  return (
    Boolean(binding.ctrl) === event.ctrlKey &&
    Boolean(binding.meta) === event.metaKey &&
    Boolean(binding.alt) === event.altKey &&
    Boolean(binding.shift) === event.shiftKey
  );
}

function matchesKey(event: KeyboardLike, binding: KeyBinding): boolean {
  if (!sameModifiers(event, binding)) {
    return false;
  }
  if (binding.code) {
    return event.code === binding.code;
  }
  return event.key.toLowerCase() === binding.key.toLowerCase();
}

function runtimeFor(
  options: { platform: InputPlatform; hasWorkspace: boolean; runCommand: (id: string) => void },
  source: ActionRuntime["source"],
): ActionRuntime {
  return {
    source,
    platform: options.platform,
    hasWorkspace: options.hasWorkspace,
    runCommand: options.runCommand,
  };
}

function execute(
  action: ActionDefinition,
  runtime: ActionRuntime,
): void {
  void Promise.resolve(action.run(runtime)).catch((error) => {
    console.error(`Action ${action.id} failed`, error);
  });
}

export function createInputRouter(options: InputRouterOptions) {
  const bindings =
    options.bindings ?? bindingsForPlatform(options.platform, options.actions);

  function resolveKey(
    event: KeyboardLike,
    scope: ActionScope = "global",
  ): ActionDefinition | null {
    for (const { action, binding } of bindings) {
      if (binding.kind !== "key") {
        continue;
      }
      if (binding.platform !== options.platform) {
        continue;
      }
      if ((binding.scope ?? "global") !== scope) {
        continue;
      }
      if (!matchesKey(event, binding)) {
        continue;
      }
      if (isEditableTarget(event.target) && !action.allowInEditable) {
        continue;
      }
      return action;
    }
    return null;
  }

  function runAction(
    action: ActionDefinition,
    source: ActionRuntime["source"],
    runtime: InputRouterRuntime,
  ): boolean {
    const actionRuntime = runtimeFor(
      {
        platform: options.platform,
        hasWorkspace: runtime.hasWorkspace,
        runCommand: runtime.runCommand,
      },
      source,
    );
    if (action.enabled && !action.enabled(actionRuntime)) {
      return false;
    }
    execute(action, actionRuntime);
    return true;
  }

  return {
    platform: options.platform,

    handleKeyDown(
      event: KeyboardLike,
      runtime: InputRouterRuntime,
      scope: ActionScope = "global",
    ): boolean {
      if (event.defaultPrevented) {
        return false;
      }
      if (event.isComposing || event.keyCode === 229) {
        return false;
      }
      const action = resolveKey(event, scope);
      if (!action) {
        return false;
      }
      if (event.repeat && !action.repeatable) {
        return false;
      }
      if (!runAction(action, "keyboard", runtime)) {
        return false;
      }
      event.preventDefault?.();
      return true;
    },

    triggerSurface(
      surface: string,
      runtime: InputRouterRuntime,
    ): boolean {
      const binding = bindings.find(
        (candidate) =>
          candidate.binding.kind === "surface" &&
          candidate.binding.platform === options.platform &&
          candidate.binding.surface === surface,
      );
      if (!binding) {
        return false;
      }
      return runAction(binding.action, "surface", runtime);
    },
  };
}