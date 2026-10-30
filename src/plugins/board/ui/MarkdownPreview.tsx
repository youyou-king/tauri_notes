import { renderMarkdownHtml } from "../../../ui/sdk";

export default function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(markdown) }}
    />
  );
}
