import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  editorSnapshot,
  type EditorSnapshot,
} from "../../../application/state/editorSnapshot";

export function useEditorField<T>(
  editor: Editor | null,
  initial: T,
  select: (snapshot: EditorSnapshot) => T,
  isEqual: (left: T, right: T) => boolean,
): T {
  const [value, setValue] = useState<T>(initial);
  const valueRef = useRef(value);
  const selectRef = useRef(select);
  const equalRef = useRef(isEqual);
  selectRef.current = select;
  equalRef.current = isEqual;

  useEffect(() => {
    if (!editor) {
      return;
    }
    const update = () => {
      if (editor.isDestroyed) {
        return;
      }
      const next = selectRef.current(editorSnapshot(editor));
      if (!equalRef.current(valueRef.current, next)) {
        valueRef.current = next;
        setValue(next);
      }
    };
    update();
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  return value;
}
