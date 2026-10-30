import { describe, expect, it } from "vitest";
import {
  isEditableTarget,
  keyboardIntent,
  pointerIntent,
} from "./adapter";
import {
  createIntent,
  dispatchIntent,
  registerIntentHandler,
} from "./intents";

function key(
  value: string,
  overrides: Partial<{
    altKey: boolean;
    shiftKey: boolean;
    target: EventTarget | null;
    defaultPrevented: boolean;
  }> = {},
) {
  return {
    key: value,
    altKey: false,
    shiftKey: false,
    target: null,
    ...overrides,
  };
}

describe("input adapter", () => {
  it("maps escape, context menu and back gestures", () => {
    expect(keyboardIntent(key("Escape"))).toMatchObject({
      name: "cancel",
      source: "keyboard",
    });
    expect(
      keyboardIntent(key("F10", { shiftKey: true })),
    ).toMatchObject({ name: "contextMenu" });
    expect(
      keyboardIntent(key("ArrowLeft", { altKey: true })),
    ).toMatchObject({ name: "back" });
    expect(
      keyboardIntent(key("Escape", { defaultPrevented: true })),
    ).toBeNull();
  });

  it("ignores back navigation while editing", () => {
    const input = document.createElement("input");
    expect(
      keyboardIntent(
        key("ArrowLeft", { altKey: true, target: input }),
      ),
    ).toBeNull();
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(document.body)).toBe(false);
  });

  it("maps secondary pointer input to contextMenu", () => {
    expect(pointerIntent({ button: 2, pointerType: "mouse" })).toEqual({
      name: "contextMenu",
      source: "mouse",
    });
    expect(pointerIntent({ button: 2, pointerType: "touch" })).toEqual({
      name: "contextMenu",
      source: "touch",
    });
    expect(pointerIntent({ button: 0 })).toBeNull();
  });
});

describe("intent registry", () => {
  it("dispatches to the first handling listener and unregisters", () => {
    const calls: string[] = [];
    const unregisterFirst = registerIntentHandler("activate", () => {
      calls.push("first");
      return false;
    });
    const unregisterSecond = registerIntentHandler("activate", () => {
      calls.push("second");
      return true;
    });
    const unregisterThird = registerIntentHandler("activate", () => {
      calls.push("third");
      return true;
    });

    expect(dispatchIntent(createIntent("activate", "keyboard"))).toBe(true);
    expect(calls).toEqual(["first", "second"]);

    unregisterFirst();
    unregisterSecond();
    unregisterThird();
    expect(dispatchIntent(createIntent("activate", "keyboard"))).toBe(false);
  });

  it("returns false when no listener exists", () => {
    expect(dispatchIntent(createIntent("missing", "programmatic"))).toBe(
      false,
    );
  });
});
