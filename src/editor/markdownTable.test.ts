import { describe, expect, it } from "vitest";
import { importedBlocksToDocument } from "./importedMarkdown";
import { isMarkdownTable } from "./markdownTable";

const tableMarkdown = [
  "| 表头 | 表头 |",
  "| ---- | ---- |",
  "| 单元格 | 单元格 |",
].join("\n");

describe("markdown table recognition", () => {
  it("recognizes a pipe table", () => {
    expect(isMarkdownTable(tableMarkdown)).toBe(true);
    expect(isMarkdownTable("普通段落，没有表格")).toBe(false);
    expect(
      isMarkdownTable(["| a | b |", "| --- | --- |"].join("\n")),
    ).toBe(true);
    expect(
      isMarkdownTable(["文本", "| a | b |", "| --- | --- |"].join("\n")),
    ).toBe(false);
  });

  it("converts a paragraph containing raw table markdown", () => {
    const document = importedBlocksToDocument([
      {
        id: "block-1",
        documentId: "doc-1",
        blockType: "paragraph",
        orderKey: "a",
        widthSpan: 12,
        heightMode: "auto",
        heightPx: null,
        contentJson: JSON.stringify({ type: "paragraph" }),
        plainText: tableMarkdown,
      },
    ]);

    expect(document.content?.[0]).toMatchObject({
      type: "tableBlock",
      attrs: { markdown: tableMarkdown },
    });
  });
});
