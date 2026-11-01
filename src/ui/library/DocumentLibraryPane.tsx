import { useEffect, useState } from "react";
import { APP_EVENTS, emitAppEvent } from "../../kernel/events";
import { TauriImportedDocumentRepository } from "../../infrastructure/tauriImportedDocumentRepository";
import { documentService } from "../../application/documentService";
import { resolveInputPlatform } from "../../kernel/action";
import { runDocumentAction } from "../../app/documentActions";
import { useRuntimeServices } from "../../runtime";
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
  const [lastDeleted, setLastDeleted] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const { dialogs, documentActions } = useRuntimeServices();
  const platform = resolveInputPlatform();

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

  async function undoDelete() {
    if (!lastDeleted) {
      return;
    }
    try {
      await documentService.restore(workspaceRoot, lastDeleted.id);
      setStatus(`已恢复 ${lastDeleted.title}`);
      setLastDeleted(null);
      setReload((current) => current + 1);
      emitAppEvent(APP_EVENTS.documentChanged);
    } catch (error) {
      setStatus(`恢复失败：${String(error)}`);
    }
  }

  async function createDocument() {
    const title = await dialogs.prompt({ title: "新文档标题" });
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
    try {
      await runDocumentAction("document.rename", {
        platform,
        document: {
          id: document.id,
          title: document.title,
          workspaceRoot,
        },
        dialogs,
        documentActions,
      });
      setReload((current) => current + 1);
    } catch (error) {
      setStatus(`重命名失败：${String(error)}`);
    }
  }

  async function deleteDocument(document: ImportedDocumentSummary) {
    try {
      await runDocumentAction("document.delete", {
        platform,
        document: {
          id: document.id,
          title: document.title,
          workspaceRoot,
        },
        dialogs,
        documentActions,
        onDeleted: () => {
          setLastDeleted({ id: document.id, title: document.title });
          setReload((current) => current + 1);
        },
      });
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
          {lastDeleted && (
            <button type="button" onClick={() => void undoDelete()}>
              撤销删除
            </button>
          )}
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
