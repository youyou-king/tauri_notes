import type { Intent } from "./intents";

type KeyboardLike = {
  key: string;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
  defaultPrevented?: boolean;
};

type PointerLike = {
  button: number;
  pointerType?: string;
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

export function keyboardIntent(event: KeyboardLike): Intent | null {
  if (event.defaultPrevented) {
    return null;
  }
  const editing = isEditableTarget(event.target);
  if (event.key === "Escape") {
    return { name: "cancel", source: "keyboard" };
  }
  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
    return { name: "contextMenu", source: "keyboard" };
  }
  if (event.altKey && event.key === "ArrowLeft" && !editing) {
    return { name: "back", source: "keyboard" };
  }
  return null;
}

export function pointerIntent(event: PointerLike): Intent | null {
  if (event.button === 2) {
    return {
      name: "contextMenu",
      source: event.pointerType === "touch" ? "touch" : "mouse",
    };
  }
  return null;
}
