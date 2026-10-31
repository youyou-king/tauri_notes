import type { Editor } from "@tiptap/react";
import { EditorStats } from "./EditorStats";

type EditorStatusBarProps = {
  saving: boolean;
  status: string;
  editor: Editor | null;
};

export function EditorStatusBar({
  saving,
  status,
  editor,
}: EditorStatusBarProps) {
  return (
    <div className="block-status-bar" role="status" aria-live="polite">
      {saving ? "保存中…" : status} · <EditorStats editor={editor} />
    </div>
  );
}
