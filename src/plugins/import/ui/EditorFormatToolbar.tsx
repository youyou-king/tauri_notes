import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { EMPTY_EDITOR_SNAPSHOT } from "../../../application/state/editorSnapshot";
import {
  createFormatToolbarItems,
  isFormatActive,
} from "./formatToolbar";
import { LinkPopover } from "./LinkPopover";
import { useEditorField } from "./useEditorField";

type EditorFormatToolbarProps = {
  editor: Editor;
  insertTable: () => void;
  insertEmptyViewport: () => void;
};

export function EditorFormatToolbar({
  editor,
  insertTable,
  insertEmptyViewport,
}: EditorFormatToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const toolbar = useEditorField(
    editor,
    EMPTY_EDITOR_SNAPSHOT.toolbar,
    (snapshot) => snapshot.toolbar,
    (left, right) =>
      left.bold === right.bold &&
      left.italic === right.italic &&
      left.strike === right.strike &&
      left.code === right.code &&
      left.headingLevel === right.headingLevel &&
      left.bulletList === right.bulletList &&
      left.taskList === right.taskList &&
      left.blockquote === right.blockquote &&
      left.codeBlock === right.codeBlock &&
      left.tableBlock === right.tableBlock &&
      left.link === right.link &&
      left.canUndo === right.canUndo &&
      left.canRedo === right.canRedo,
  );
  const formatItems = createFormatToolbarItems(
    editor,
    toolbar,
    insertTable,
    (href) => {
      setLinkUrl(href);
      setLinkOpen((current) => !current);
    },
  );
  return (
    <>
              <div className="block-format-toolbar">
                {formatItems.map((item) => {
                  const active = isFormatActive(toolbar, item.active);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      title={item.title}
                      className={active ? "active" : ""}
                      aria-pressed={item.active ? active : undefined}
                      disabled={item.disabled ?? false}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={item.run}
                    >
                      {item.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="block-format-icon-button"
                  title="插入视图"
                  aria-label="插入视图"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={insertEmptyViewport}
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2.25" y="3.25" width="11.5" height="9.5" rx="1.5" />
                    <path d="M2.25 6.25h11.5M5 3.25v3" />
                  </svg>
                </button>
              </div>
            {linkOpen && (
              <LinkPopover
                editor={editor}
                linkUrl={linkUrl}
                showRemove={toolbar.link}
                onLinkUrlChange={setLinkUrl}
                onLinkOpenChange={setLinkOpen}
              />
            )}
    </>
  );
}
