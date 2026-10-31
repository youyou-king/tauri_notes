import type { Editor } from "@tiptap/react";

type LinkPopoverProps = {
  editor: Editor;
  linkUrl: string;
  showRemove: boolean;
  onLinkUrlChange: (url: string) => void;
  onLinkOpenChange: (open: boolean) => void;
};

export function LinkPopover({
  editor,
  linkUrl,
  showRemove,
  onLinkUrlChange,
  onLinkOpenChange,
}: LinkPopoverProps) {
  return (
            <div className="block-link-popover">
              <input
                autoFocus
                value={linkUrl}
                placeholder="https://…"
                onChange={(event) => onLinkUrlChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onLinkOpenChange(false);
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .setLink({ href: linkUrl })
                      .run();
                    onLinkOpenChange(false);
                  }
                }}
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: linkUrl })
                    .run();
                  onLinkOpenChange(false);
                }}
              >
                应用
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onLinkOpenChange(false)}
              >
                取消
              </button>
              {showRemove && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    onLinkOpenChange(false);
                  }}
                >
                  移除
                </button>
              )}
            </div>
  );
}
