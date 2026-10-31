import type { Editor } from "@tiptap/react";
import { EMPTY_EDITOR_SNAPSHOT } from "../../../application/state/editorSnapshot";
import { useEditorField } from "./useEditorField";

export function EditorStats({ editor }: { editor: Editor | null }) {
  const stats = useEditorField(
    editor,
    EMPTY_EDITOR_SNAPSHOT.stats,
    (snapshot) => snapshot.stats,
    (left, right) =>
      left.blocks === right.blocks &&
      left.characters === right.characters,
  );
  return (
    <>
      {stats.blocks} 块 · {stats.characters.toLocaleString()} 字
    </>
  );
}
