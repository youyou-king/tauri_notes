import type { Editor } from "@tiptap/core";

export type FormatActive =
  | string
  | {
      type: string;
      attrs?: Record<string, unknown>;
    };

export type FormatToolbarItem = {
  label: string;
  title: string;
  active?: FormatActive;
  disabled?: () => boolean;
  run: () => void;
};

type ActiveEditor = Pick<Editor, "isActive">;

/**
 * `isActive("heading")` is true for every heading level. Toolbar buttons must
 * pass the level attributes so H1 and H2 cannot both look active.
 */
export function isFormatActive(
  editor: ActiveEditor,
  active: FormatActive | undefined,
): boolean {
  if (!active) {
    return false;
  }
  if (typeof active === "string") {
    return editor.isActive(active);
  }
  return editor.isActive(active.type, active.attrs);
}
