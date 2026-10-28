import { Extension, InputRule, markInputRule } from "@tiptap/core";

/**
 * 中文写作里 Markdown 标记通常紧跟正文，例如“这是**重点**”。
 * Tiptap 内置规则要求标记前有空白，这里补一组无前置空白要求的规则。
 */
export const MarkdownInlineRules = Extension.create({
  name: "markdownInlineRules",

  addInputRules() {
    const bold = this.editor.schema.marks.bold;
    const italic = this.editor.schema.marks.italic;
    const rules = [];

    if (bold) {
      rules.push(
        markInputRule({
          find: /(\*\*([^*\n]+)\*\*)$/,
          type: bold,
        }),
        markInputRule({
          find: /(__([^_\n]+)__)$/,
          type: bold,
        }),
      );
    }

    if (italic) {
      rules.push(
        new InputRule({
          find: /(^|[^*])(\*([^*\n]+)\*)$/,
          handler: ({ state, range, match }) => {
            const content = match[3];
            const prefixLength = match[1]?.length ?? 0;
            const textStart = range.from + match[0].indexOf(content);
            const textEnd = textStart + content.length;
            const tr = state.tr;
            tr.delete(textEnd, range.to);
            tr.delete(range.from + prefixLength, textStart);
            const markStart = range.from + prefixLength;
            tr.addMark(markStart, markStart + content.length, italic.create());
            tr.removeStoredMark(italic);
          },
        }),
        new InputRule({
          find: /(^|[^_])(_([^_\n]+)_)$/,
          handler: ({ state, range, match }) => {
            const content = match[3];
            const prefixLength = match[1]?.length ?? 0;
            const textStart = range.from + match[0].indexOf(content);
            const textEnd = textStart + content.length;
            const tr = state.tr;
            tr.delete(textEnd, range.to);
            tr.delete(range.from + prefixLength, textStart);
            const markStart = range.from + prefixLength;
            tr.addMark(markStart, markStart + content.length, italic.create());
            tr.removeStoredMark(italic);
          },
        }),
      );
    }

    return rules;
  },
});
