import type { Editor } from "@tiptap/react";
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

export function createFormatToolbarItems(
  editor: Editor,
  toolbar: EditorToolbarSnapshot,
  insertTable: () => void,
  openLink: (href: string) => void,
): FormatToolbarItem[] {
  return [
        {
          label: "↶",
          title: "撤销",
          disabled: !toolbar.canUndo,
          run: () => editor.chain().focus().undo().run(),
        },
        {
          label: "↷",
          title: "重做",
          disabled: !toolbar.canRedo,
          run: () => editor.chain().focus().redo().run(),
        },
        {
          label: "B",
          title: "粗体",
          active: "bold",
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: "I",
          title: "斜体",
          active: "italic",
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: "S",
          title: "删除线",
          active: "strike",
          run: () => editor.chain().focus().toggleStrike().run(),
        },
        {
          label: "</>",
          title: "行内代码",
          active: "code",
          run: () => editor.chain().focus().toggleCode().run(),
        },
        {
          label: "H1",
          title: "一级标题",
          active: { headingLevel: 1 },
          run: () =>
            editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          label: "H2",
          title: "二级标题",
          active: { headingLevel: 2 },
          run: () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: "•",
          title: "无序列表",
          active: "bulletList",
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: "☑",
          title: "任务列表",
          active: "taskList",
          run: () =>
            editor.chain().focus().toggleList("taskList", "taskItem").run(),
        },
        {
          label: "“",
          title: "引用",
          active: "blockquote",
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: "{ }",
          title: "代码块",
          active: "codeBlock",
          run: () => editor.chain().focus().toggleCodeBlock().run(),
        },
        {
          label: "—",
          title: "分隔线",
          run: () => editor.chain().focus().setHorizontalRule().run(),
        },
        {
          label: "▦",
          title: "插入表格",
          active: "tableBlock",
          run: insertTable,
        },
        {
          label: "🔗",
          title: "链接",
          active: "link",
          run: () => {
            openLink(String(editor.getAttributes("link").href ?? ""));
          },
        },
  ];
}
