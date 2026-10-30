export function tableRows(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"))
    .map((line) => {
      let text = line;
      if (text.startsWith("|")) text = text.slice(1);
      if (text.endsWith("|")) text = text.slice(0, -1);
      return text.split("|").map((cell) => cell.trim());
    });
}

export function isDividerRow(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

export function isMarkdownTable(markdown: string): boolean {
  const lines = markdown
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines[0].includes("|")) {
    return false;
  }
  if (!lines.every((line) => line.includes("|"))) {
    return false;
  }
  const rows = tableRows(markdown);
  const dividerIndex = rows.findIndex(isDividerRow);
  return dividerIndex > 0 && (rows[dividerIndex - 1]?.length ?? 0) >= 2;
}
