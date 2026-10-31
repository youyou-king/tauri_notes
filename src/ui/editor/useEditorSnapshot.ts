import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  editorSnapshot,
  EMPTY_EDITOR_SNAPSHOT,
  type EditorSnapshot,
} from "../../application/state/editorSnapshot";

/**
 * The editor is the source of truth. Toolbar flags, selected block metadata
 * and document counts are read-only projections of one EditorState snapshot.
 *
 * A single subscription updates one snapshot state. Components never mirror
 * editor selections or marks into their own state.
 */
export function useEditorSnapshot(editor: Editor | null): EditorSnapshot {
  const [snapshot, setSnapshot] =
    useState<EditorSnapshot>(EMPTY_EDITOR_SNAPSHOT);

  useEffect(() => {
    if (!editor) {
      setSnapshot(EMPTY_EDITOR_SNAPSHOT);
      return;
    }
    const update = () => {
      if (!editor.isDestroyed) {
        setSnapshot(editorSnapshot(editor));
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

  return snapshot;
}