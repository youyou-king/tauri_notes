import { useEffect, useState } from "react";
import { documentService } from "../../application/documentService";
import type { StoredBlock } from "../../domain/importedDocument";
import { renderMarkdownHtml } from "../sdk";

export function MobileDocumentView({
  workspaceRoot,
  documentId,
}: {
  workspaceRoot: string;
  documentId: string;
}) {
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<StoredBlock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      documentService.getTitle(workspaceRoot, documentId),
      documentService.loadBlocks(workspaceRoot, documentId),
    ])
      .then(([nextTitle, nextBlocks]) => {
        if (cancelled) {
          return;
        }
        setTitle(nextTitle);
        setBlocks(nextBlocks);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, workspaceRoot]);

  return (
    <article className="mobile-document">
      <h1>{title || "文档"}</h1>
      {error && <p className="theme-error">{error}</p>}
      {blocks.map((block) => (
        <div
          key={block.id}
          className="mobile-document-block"
          dangerouslySetInnerHTML={{
            __html: renderMarkdownHtml(block.plainText),
          }}
        />
      ))}
    </article>
  );
}