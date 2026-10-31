import type { EditorToolbarSnapshot } from "../../../application/state/editorSnapshot";

export type FormatFlag =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "bulletList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "tableBlock"
  | "link";

export type FormatActive =
  | FormatFlag
  | {
      headingLevel: 1 | 2;
    };

export type FormatToolbarItem = {
  label: string;
  title: string;
  active?: FormatActive;
  disabled?: boolean;
  run: () => void;
};

export function isFormatActive(
  toolbar: EditorToolbarSnapshot,
  active: FormatActive | undefined,
): boolean {
  if (!active) {
    return false;
  }
  if (typeof active === "string") {
    return toolbar[active];
  }
  return toolbar.headingLevel === active.headingLevel;
}
