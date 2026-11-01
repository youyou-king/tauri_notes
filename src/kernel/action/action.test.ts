import { describe, expect, it, vi } from "vitest";
import {
  applyKeymap,
  createInputRouter,
  registerAction,
  findBindingConflicts,
  listActions,
  clearActionsForTests,
} from "./index";
import type { ActionDefinition } from "./types";

function action(
  id: string,
  overrides: Partial<ActionDefinition> = {},
): ActionDefinition {
  return {
    id,
    title: id,
    category: "test",
    scope: "global",
    platforms: ["desktop", "mac", "mobile"],
    defaultBindings: [
      {
        kind: "key",
        platform: "desktop",
        key: "p",
        ctrl: true,
        scope: "global",
      },
    ],
    run: ({ runCommand }) => runCommand(id),
    ...overrides,
  };
}

function key(
  value: string,
  options: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    isComposing: boolean;
    repeat: boolean;
    target: EventTarget | null;
  }> = {},
) {
  const preventDefault = vi.fn();
  return {
    key: value,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    preventDefault,
    ...options,
  };
}

describe("action registry", () => {
  it("registers and lists actions", () => {
    clearActionsForTests();
    const search = action("test.search");
    registerAction(search);
    expect(listActions()).toEqual([search]);
  });

  it("detects duplicate bindings across actions", () => {
    clearActionsForTests();
    registerAction(action("test.one"));
    registerAction(action("test.two"));
    const conflicts = findBindingConflicts();
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].actionIds).toEqual(["test.one", "test.two"]);
  });
});

describe("input router", () => {
  it("matches ctrl on desktop and meta on mac", () => {
    clearActionsForTests();
    const desktop = action("test.desktop");
    const mac = action("test.mac", {
      defaultBindings: [
        {
          kind: "key",
          platform: "mac",
          key: "p",
          meta: true,
          scope: "global",
        },
      ],
    });
    registerAction(desktop);
    registerAction(mac);

    const desktopRouter = createInputRouter({
      platform: "desktop",
      actions: [desktop],
    });
    const macRouter = createInputRouter({
      platform: "mac",
      actions: [mac],
    });

    const desktopEvent = key("p", { ctrlKey: true });
    expect(
      desktopRouter.handleKeyDown(desktopEvent, {
        hasWorkspace: true,
        runCommand: vi.fn(),
      }),
    ).toBe(true);
    expect(desktopEvent.preventDefault).toHaveBeenCalled();

    const macEvent = key("p", { metaKey: true });
    expect(
      macRouter.handleKeyDown(macEvent, {
        hasWorkspace: true,
        runCommand: vi.fn(),
      }),
    ).toBe(true);
    expect(macEvent.preventDefault).toHaveBeenCalled();

    expect(
      macRouter.handleKeyDown(key("p", { ctrlKey: true }), {
        hasWorkspace: true,
        runCommand: vi.fn(),
      }),
    ).toBe(false);
  });

  it("does not fire while composing or repeating", () => {
    clearActionsForTests();
    const search = action("test.search");
    const router = createInputRouter({
      platform: "desktop",
      actions: [search],
    });
    const runCommand = vi.fn();

    expect(
      router.handleKeyDown(
        key("p", { ctrlKey: true, isComposing: true }),
        { hasWorkspace: true, runCommand },
      ),
    ).toBe(false);
    expect(
      router.handleKeyDown(
        key("p", { ctrlKey: true, repeat: true }),
        { hasWorkspace: true, runCommand },
      ),
    ).toBe(false);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("respects editable targets unless allowInEditable is set", () => {
    clearActionsForTests();
    const input = document.createElement("input");
    const blocked = action("test.blocked");
    const allowed = action("test.allowed", {
      allowInEditable: true,
    });
    const blockedRouter = createInputRouter({
      platform: "desktop",
      actions: [blocked],
    });
    const allowedRouter = createInputRouter({
      platform: "desktop",
      actions: [allowed],
    });
    const runtime = { hasWorkspace: true, runCommand: vi.fn() };

    expect(
      blockedRouter.handleKeyDown(
        key("p", { ctrlKey: true, target: input }),
        runtime,
      ),
    ).toBe(false);
    expect(
      allowedRouter.handleKeyDown(
        key("p", { ctrlKey: true, target: input }),
        runtime,
      ),
    ).toBe(true);
  });

  it("triggers mobile surface bindings", () => {
    clearActionsForTests();
    const search = action("test.search", {
      defaultBindings: [
        {
          kind: "surface",
          platform: "mobile",
          surface: "search.open",
          scope: "mobile",
        },
      ],
    });
    const router = createInputRouter({
      platform: "mobile",
      actions: [search],
    });
    const runCommand = vi.fn();
    expect(
      router.triggerSurface("search.open", {
        hasWorkspace: true,
        runCommand,
      }),
    ).toBe(true);
    expect(runCommand).toHaveBeenCalledWith("test.search");
    expect(
      router.triggerSurface("missing", {
        hasWorkspace: true,
        runCommand,
      }),
    ).toBe(false);
  });
});
describe("keymap overrides", () => {
  it("replaces only the overridden platform", () => {
    const original = action("test.override", {
      platforms: ["desktop", "mac", "mobile"],
      defaultBindings: [
        {
          kind: "key",
          platform: "desktop",
          key: "p",
          ctrl: true,
          scope: "global",
        },
        {
          kind: "key",
          platform: "mac",
          key: "p",
          meta: true,
          scope: "global",
        },
        {
          kind: "surface",
          platform: "mobile",
          surface: "search.open",
          scope: "mobile",
        },
      ],
    });
    const [merged] = applyKeymap([original], {
      version: 2,
      bindings: [
        {
          action: "test.override",
          platform: "desktop",
          key: "k",
          ctrl: true,
        },
      ],
    });
    expect(
      merged.defaultBindings.some(
        (binding) =>
          binding.kind === "key" &&
          binding.platform === "desktop" &&
          binding.key === "k",
      ),
    ).toBe(true);
    expect(
      merged.defaultBindings.some(
        (binding) =>
          binding.kind === "key" &&
          binding.platform === "desktop" &&
          binding.key === "p",
      ),
    ).toBe(false);
    expect(
      merged.defaultBindings.some(
        (binding) =>
          binding.kind === "key" && binding.platform === "mac",
      ),
    ).toBe(true);
    expect(
      merged.defaultBindings.some(
        (binding) =>
          binding.kind === "surface" && binding.platform === "mobile",
      ),
    ).toBe(true);
  });
});