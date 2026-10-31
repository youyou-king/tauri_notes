import { useEffect, useState } from "react";
import { APP_EVENTS, emitAppEvent } from "../../kernel/events";
import { TauriImportedDocumentRepository } from "../../infrastructure/tauriImportedDocumentRepository";
import { documentService } from "../../application/documentService";
import { confirmDialog } from "../dialog/confirmDialog";
import { PanelShell } from "../panels/PanelShell";
import type { ImportedDocumentSummary } from "../../domain/importedDocument";

export default function DocumentLibraryPane({
  workspaceRoot,
  mapId,
}: {
  workspaceRoot: string;
  mapId: string;
}) {
  const [documents, setDocuments] = useState<ImportedDocumentSummary[]>([]);
  const [status, setStatus] = useState("加载文档库…");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const repository = new TauriImportedDocumentRepository(workspaceRoot);
    void repository
      .list()
      .then((list) => {
        if (!cancelled) {
          setDocuments(list);
          setStatus(`${list.length} 个文档`);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(`读取失败：${String(error)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reload, workspaceRoot]);

  async function createDocument() {
    const title = window.prompt("新文档标题");
    if (!title?.trim()) {
      return;
    }
    try {
      const created = await documentService.create(
        workspaceRoot,
        mapId,
        title.trim(),
      );
      emitAppEvent(APP_EVENTS.openBlockDocument, created.id);
      setReload((current) => current + 1);
      emitAppEvent(APP_EVENTS.documentChanged);
    } catch (error) {
      setStatus(`新建失败：${String(error)}`);
    }
  }

  async function renameDocument(document: ImportedDocumentSummary) {
    const title = window.prompt("重命名文档", document.title);
    if (!title?.trim() || title.trim() === document.title) {
      return;
    }
    try {
      await documentService.rename(
        workspaceRoot,
        document.id,
        title.trim(),
      );
      setReload((current) => current + 1);
      emitAppEvent(APP_EVENTS.documentChanged);
    } catch (error) {
      setStatus(`重命名失败：${String(error)}`);
    }
  }

  async function deleteDocument(document: ImportedDocumentSummary) {
    if (
      !(await confirmDialog({
        title: "删除文档？",
        message: `删除“${document.title}”？`,
        confirmLabel: "删除",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await documentService.delete(workspaceRoot, document.id);
      setReload((current) => current + 1);
      emitAppEvent(APP_EVENTS.documentChanged);
    } catch (error) {
      setStatus(`删除失败：${String(error)}`);
    }
  }

  return (
    <PanelShell
      className="document-library-panel"
      bodyClassName="document-library"
      title="文档库"
      icon="📚"
      status={status}
      toolbar={
        <>
          <button type="button" onClick={() => void createDocument()}>
            新建文档
          </button>
          <button
            type="button"
            onClick={() => setReload((current) => current + 1)}
          >
            刷新
          </button>
        </>
      }
    >
      <div className="document-library-list">
        {documents.map((document) => (
          <div key={document.id} className="document-library-row">
            <button
              type="button"
              className="document-library-open"
              onClick={() =>
                emitAppEvent(APP_EVENTS.openBlockDocument, document.id)
              }
            >
              <span>{document.title}</span>
              <small>
                {document.blockCount} 块 · {document.id}
              </small>
            </button>
            <div className="document-library-actions">
              <button
                type="button"
                onClick={() => void renameDocument(document)}
              >
                重命名
              </button>
              <button
                type="button"
                onClick={() => void deleteDocument(document)}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
