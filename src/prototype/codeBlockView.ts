import CodeBlock from "@tiptap/extension-code-block";

const LANGUAGES = [
  ["text", "text"],
  ["js", "js"],
  ["ts", "ts"],
  ["tsx", "tsx"],
  ["rust", "rust"],
  ["python", "python"],
  ["bash", "bash"],
  ["json", "json"],
  ["css", "css"],
  ["html", "html"],
  ["markdown", "markdown"],
  ["sql", "sql"],
];

export const CodeBlockView = CodeBlock.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const pre = document.createElement("pre");
      pre.className = "code-block-shell";
      const applyLayout = (current: typeof node) => {
        pre.dataset.blockId = String(current.attrs.blockId ?? "");
        pre.dataset.span = String(current.attrs.span ?? 12);
        pre.style.setProperty(
          "--code-zoom",
          `${Math.max(50, Math.min(200, Number(current.attrs.zoom ?? 100)))}%`,
        );
        pre.style.setProperty(
          "--code-zoom-width",
          `${Math.max(50, Math.min(200, Number(current.attrs.zoom ?? 100)))}%`,
        );
        pre.dataset.heightMode =
          current.attrs.heightMode === "fixed" ? "fixed" : "auto";
        pre.style.height = "";
        pre.style.setProperty(
          "--code-content-height",
          current.attrs.heightMode === "fixed"
            ? `${Number(current.attrs.heightPx ?? 240)}px`
            : "auto",
        );
      };
      applyLayout(node);

      const header = document.createElement("div");
      header.className = "code-block-header";
      header.contentEditable = "false";
      header.addEventListener("mousedown", (event) => {
        if ((event.target as HTMLElement).closest("select, button")) {
          return;
        }
        event.preventDefault();
        const position = getPos();
        if (typeof position === "number") {
          editor.chain().focus().setNodeSelection(position).run();
        }
      });

      const language = document.createElement("select");
      language.className = "code-block-language";
      LANGUAGES.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        language.append(option);
      });
      language.value = String(node.attrs.language || "text");
      language.addEventListener("mousedown", (event) => event.stopPropagation());
      language.addEventListener("change", () => {
        if (!editor.isEditable) {
          language.value = String(node.attrs.language || "text");
          return;
        }
        const position = getPos();
        if (typeof position === "number") {
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(position, undefined, {
              ...node.attrs,
              language: language.value === "text" ? null : language.value,
            }),
          );
        }
      });

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "复制";
      copy.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      header.append(language, copy);
      const code = document.createElement("code");
      code.className = node.attrs.language
        ? `language-${String(node.attrs.language)}`
        : "";
      pre.append(header, code);

      copy.addEventListener("click", () => {
        void navigator.clipboard?.writeText(code.textContent ?? "");
      });

      return {
        dom: pre,
        contentDOM: code,
        update: (updated) => {
          applyLayout(updated);
          language.value = String(updated.attrs.language || "text");
          code.className = updated.attrs.language
            ? `language-${String(updated.attrs.language)}`
            : "";
          return true;
        },
      };
    };
  },
});
