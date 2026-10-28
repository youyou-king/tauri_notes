import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const TOKEN =
  /(\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:fn|let|mut|pub|struct|enum|impl|trait|for|while|loop|if|else|match|return|use|mod|const|static|async|await|move|self|Self|true|false|None|Some|Ok|Err|class|extends|new|function|export|import|from|default|interface|type|throw|try|catch|finally|break|continue|switch|case|do|in|of|void|yield|def|elif|lambda|pass|raise|with|as|and|or|not|is|True|False)\b|\b\d+(?:\.\d+)?\b)/g;

function decorate(doc: import("@tiptap/pm/model").Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== "codeBlock") {
      return;
    }
    const text = node.textContent;
    for (const match of text.matchAll(TOKEN)) {
      const value = match[0];
      const start = position + 1 + (match.index ?? 0);
      let className = "tok-keyword";
      if (value.startsWith("//") || value.startsWith("#")) {
        className = "tok-comment";
      } else if (/^["'`]/.test(value)) {
        className = "tok-string";
      } else if (/^\d/.test(value)) {
        className = "tok-number";
      } else if (!/^\w/.test(value)) {
        continue;
      }
      decorations.push(
        Decoration.inline(start, start + value.length, { class: className }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

export const CodeHighlight = Extension.create({
  name: "codeHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("codeHighlight"),
        state: {
          init: (_, state) => decorate(state.doc),
          apply: (transaction, previous) => {
            if (transaction.docChanged) {
              return decorate(transaction.doc);
            }
            return previous.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
