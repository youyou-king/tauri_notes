function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(value: string): string {
  const url = value.trim();
  if (
    /^(https?:|mailto:|data:image\/|\.{0,2}\/)/i.test(url) ||
    !/^[a-z][a-z0-9+.-]*:/i.test(url)
  ) {
    return escapeHtml(url);
  }
  return "";
}

function inline(value: string): string {
  const code: string[] = [];
  let text = escapeHtml(value).replace(/`([^`]+)`/g, (_, content: string) => {
    code.push(`<code>${content}</code>`);
    return `\u0000${code.length - 1}\u0000`;
  });

  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt: string, src: string) =>
      `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`,
  );
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label: string, href: string) =>
      `<a href="${safeUrl(href)}" target="_blank" rel="noreferrer">${label}</a>`,
  );
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_]+)_/g, "<em>$1</em>");
  text = text.replace(/\u0000(\d+)\u0000/g, (_, index: string) => code[Number(index)]);
  return text;
}

function highlightCode(source: string, language: string): string {
  const lang = language.toLowerCase();
  if (!["rust", "rs", "javascript", "js", "typescript", "ts", "python", "py"].includes(lang)) {
    return escapeHtml(source);
  }
  const keywords = new Set(
    lang.startsWith("rust") || lang === "rs"
      ? ["fn", "let", "mut", "pub", "use", "mod", "impl", "struct", "enum", "trait", "match", "if", "else", "for", "while", "loop", "return", "self", "Self", "crate", "super", "where", "async", "await", "move", "ref", "dyn", "const", "static", "type", "unsafe", "extern", "true", "false"]
      : lang.startsWith("python") || lang === "py"
        ? ["def", "class", "import", "from", "as", "if", "elif", "else", "for", "while", "return", "yield", "try", "except", "finally", "with", "lambda", "None", "True", "False", "and", "or", "not", "in", "is", "pass", "raise", "global", "nonlocal", "async", "await"]
        : ["function", "const", "let", "var", "if", "else", "for", "while", "return", "class", "extends", "new", "import", "from", "export", "default", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "interface", "type", "public", "private", "readonly", "true", "false", "null", "undefined"],
  );
  const token =
    /(\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b)/g;
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    const value = match[0];
    const index = match.index ?? 0;
    output += escapeHtml(source.slice(cursor, index));
    if (value.startsWith("//") || (value.startsWith("#") && !value.startsWith("#["))) {
      output += `<span class="tok-comment">${escapeHtml(value)}</span>`;
    } else if (/^["'`]/.test(value)) {
      output += `<span class="tok-string">${escapeHtml(value)}</span>`;
    } else if (/^\d/.test(value)) {
      output += `<span class="tok-number">${escapeHtml(value)}</span>`;
    } else if (keywords.has(value)) {
      output += `<span class="tok-keyword">${escapeHtml(value)}</span>`;
    } else {
      output += escapeHtml(value);
    }
    cursor = index + value.length;
  }
  output += escapeHtml(source.slice(cursor));
  return output;
}

const ALLOWED_HTML = new Set([
  "a", "abbr", "b", "blockquote", "br", "code", "del", "details", "div",
  "em", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "s",
  "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "th",
  "thead", "tr", "u", "ul", "hr",
]);

function sanitizeBlockHtml(source: string): string {
  if (typeof DOMParser === "undefined") {
    return escapeHtml(source);
  }
  const doc = new DOMParser().parseFromString(source, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach(
    (node) => node.remove(),
  );
  for (const element of [...doc.body.querySelectorAll("*")]) {
    if (!ALLOWED_HTML.has(element.tagName.toLowerCase())) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith("on") ||
        name === "style" ||
        ((name === "href" || name === "src") && /^javascript:/i.test(value))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return doc.body.innerHTML;
}

function isRawHtml(line: string): boolean {
  return /^\s*<([a-z][\w-]*)(\s|>|\/)/i.test(line);
}

const FENCE = /^\s*(```|~~~)\s*([\w-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^(\s*)([-+*]|\d+[.)])\s+(.*)$/;
const HR = /^\s*((---|\*\*\*|___)\s*){1,}$/;
const TABLE_DIVIDER =
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function isBlockStart(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    LIST_ITEM.test(line) ||
    HR.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*<!--/.test(line)
  );
}

function splitTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith("|")) {
    text = text.slice(1);
  }
  if (text.endsWith("|")) {
    text = text.slice(0, -1);
  }
  return text.split("|").map((cell) => cell.trim());
}

function renderTable(lines: string[], start: number): [string, number] {
  const rawHeader = splitTableRow(lines[start]);
  const divider = splitTableRow(lines[start + 1]);
  const rows: string[][] = [];
  let index = start + 2;
  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const isBlankColumn = (column: number) =>
    !rawHeader[column]?.trim() &&
    rows.every((row) => !row[column]?.trim());
  let first = 0;
  let last = rawHeader.length - 1;
  while (first < last && isBlankColumn(first)) {
    first += 1;
  }
  while (last > first && isBlankColumn(last)) {
    last -= 1;
  }

  const header = rawHeader.slice(first, last + 1);
  const align = divider.slice(first, last + 1).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    return left && right ? "center" : right ? "right" : left ? "left" : "";
  });
  const normalizedRows = rows.map((row) => row.slice(first, last + 1));

  if (header.length === 0) {
    return ["", index];
  }

  const cell = (value: string, column: number, tag: "th" | "td") =>
    `<${tag}${align[column] ? ` style="text-align:${align[column]}"` : ""}>${inline(value)}</${tag}>`;
  const head = `<thead><tr>${header.map((value, column) => cell(value, column, "th")).join("")}</tr></thead>`;
  const body = normalizedRows.length
    ? `<tbody>${normalizedRows
        .map(
          (row) =>
            `<tr>${header
              .map((_, column) => cell(row[column] ?? "", column, "td"))
              .join("")}</tr>`,
        )
        .join("")}</tbody>`
    : "";
  return [`<div class="md-table-wrap"><table>${head}${body}</table></div>`, index];
}

type ListItem = {
  content: string;
  ordered: boolean;
  children: ListItem[];
};

function parseList(lines: string[], start: number): [ListItem[], number] {
  const root: ListItem[] = [];
  const stack: { indent: number; item: ListItem }[] = [];
  let index = start;
  while (index < lines.length) {
    const match = lines[index].match(LIST_ITEM);
    if (!match) {
      break;
    }
    const indent = match[1].replace(/\t/g, "  ").length;
    const item: ListItem = {
      content: match[3],
      ordered: /\d/.test(match[2]),
      children: [],
    };
    while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
      stack.pop();
    }
    if (stack.length > 0 && indent > stack[stack.length - 1].indent) {
      stack[stack.length - 1].item.children.push(item);
    } else {
      root.push(item);
    }
    stack.push({ indent, item });
    index += 1;
  }
  return [root, index];
}

function renderList(items: ListItem[]): string {
  const ordered = items[0]?.ordered ?? false;
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items
    .map((item) => {
      const task = item.content.match(/^\[([ xX])\]\s+(.*)$/);
      const content = task
        ? `<input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""} /> ${inline(task[2])}`
        : inline(item.content);
      return `<li>${content}${item.children.length ? renderList(item.children) : ""}</li>`;
    })
    .join("")}</${tag}>`;
}

export function renderMarkdownHtml(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const close = fence[1];
      const language = fence[2];
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(close)) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      output.push(
        `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${highlightCode(code.join("\n"), language)}</code></pre>`,
      );
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      TABLE_DIVIDER.test(lines[index + 1])
    ) {
      const [table, next] = renderTable(lines, index);
      output.push(table);
      index = next;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const level = Math.min(6, heading[1].length + 2);
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (HR.test(line)) {
      output.push("<hr />");
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote>${renderMarkdownHtml(quote.join("\n"))}</blockquote>`);
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const [items, next] = parseList(lines, index);
      output.push(renderList(items));
      index = next;
      continue;
    }

    if (isRawHtml(line) && !line.trimStart().startsWith("<!--")) {
      const html: string[] = [];
      while (index < lines.length && lines[index].trim()) {
        html.push(lines[index]);
        index += 1;
      }
      output.push(sanitizeBlockHtml(html.join("\n")));
      continue;
    }

    if (/^\s*<!--/.test(line)) {
      // 引用标记由编辑器处理，预览里不显示原始注释。
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockStart(lines[index]) &&
      !(lines[index].includes("|") && TABLE_DIVIDER.test(lines[index + 1] ?? ""))
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return output.join("");
}
