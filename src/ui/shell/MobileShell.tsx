import { Suspense, useEffect, useState } from "react";
import { documentService } from "../../application/documentService";
import type { StoredBlock } from "../../domain/importedDocument";
import type { BoardControllerPort } from "../../kernel/panel/boardPort";
import { getUiRenderer } from "../../kernel/sdk";
import { renderMarkdownHtml } from "../sdk";
import {
  PanelContext,
  type PanelContextValue,
} from "../panels/PanelContext";
import MindMap from "../../components/MindMap";
import type { MapView, NodeView, WorkspaceView } from "../../types";

type MobileTab = "map" | "library" | "document";

type MobileDocumentLink = {
  id: string;
  title: string;
};

function collectDocuments(
  node: NodeView,
  mapId: string,
  output: MobileDocumentLink[],
): void {
  if (node.hasDocument) {
    output.push({ id: `${mapId}/${node.id}`, title: node.title });
  }
  for (const child of node.children) {
    collectDocuments(child, mapId, output);
  }
}

function MobileDocumentView({
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

export function MobileShell({
  workspace,
  activeMap,
  selected,
  board,
}: {
  workspace: WorkspaceView | null;
  activeMap: MapView | null;
  selected: NodeView | null;
  board: BoardControllerPort;
}) {
  const [tab, setTab] = useState<MobileTab>("map");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const map = activeMap ?? workspace?.maps[0] ?? null;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) {
        setDocumentId(detail);
        setEditing(false);
        setTab("document");
      }
    };
    window.addEventListener("tauri-notes:open-block-document", handler);
    return () =>
      window.removeEventListener(
        "tauri-notes:open-block-document",
        handler,
      );
  }, []);

  if (!workspace || !map) {
    return (
      <div className="mobile-shell mobile-shell-empty">
        <p>请先打开一个知识库。</p>
      </div>
    );
  }

  const requestSave = () => {
    if (editing) {
      window.dispatchEvent(new Event("tauri-notes:save-now"));
    }
  };

  const switchTab = (next: MobileTab) => {
    if (next !== tab) {
      requestSave();
    }
    setTab(next);
  };

  const openDocument = (id: string) => {
    requestSave();
    setDocumentId(id);
    setEditing(false);
    setTab("document");
  };

  const documents: MobileDocumentLink[] = [];
  collectDocuments(map.root, map.id, documents);

  const DocumentView = getUiRenderer("document.importedView");
  const panelContext: PanelContextValue = {
    workspace,
    workspaces: [workspace],
    activeMap: map,
    activePanelId: null,
    selected,
    openDocument: (mapId, nodeId) => openDocument(`${mapId}/${nodeId}`),
    openBlockDocument: (id) => openDocument(id),
    setPanelDirty: () => {},
    onSelectNode: () => {},
    onSwitchMap: () => {},
    onActivateWorkspace: () => {},
    onUnloadWorkspace: () => {},
    onRenameWorkspace: () => {},
    onPinBlock: () => {},
    board,
    lastActiveDocId: documentId,
  };

  return (
    <div className="mobile-shell">
      <header className="mobile-shell-header">
        <div>
          <strong>
            {tab === "map"
              ? map.title
              : tab === "library"
                ? "目录"
                : "文档"}
          </strong>
          <span>{workspace.title}</span>
        </div>
        <button
          type="button"
          aria-label="打开设置"
          onClick={() => {
            requestSave();
            window.dispatchEvent(new Event("settings:open"));
          }}
        >
          设置
        </button>
      </header>

      <div className="mobile-shell-content">
        {tab === "map" ? (
          <MindMap
            workspaceRoot={workspace.root}
            mapId={map.id}
            mapTitle={map.title}
            selectedId={selected?.id ?? null}
            onOpenDocument={openDocument}
          />
        ) : tab === "library" ? (
          documents.length > 0 ? (
            <div className="mobile-library">
              {documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => openDocument(document.id)}
                >
                  <strong>{document.title}</strong>
                  <span>{document.id}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mobile-shell-empty">
              <p>当前导图还没有文档。</p>
            </div>
          )
        ) : documentId ? (
          <div className="mobile-document-shell">
            <div className="mobile-document-actions">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new Event("tauri-notes:save-now"),
                      )
                    }
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new Event("tauri-notes:save-now"),
                      );
                      setEditing(false);
                    }}
                  >
                    完成
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setEditing(true)}>
                  编辑
                </button>
              )}
            </div>
            {editing && DocumentView ? (
              <PanelContext.Provider value={panelContext}>
                <Suspense
                  fallback={
                    <div className="panel-loading">加载编辑器…</div>
                  }
                >
                  <DocumentView
                    workspaceRoot={workspace.root}
                    documentId={documentId}
                  />
                </Suspense>
              </PanelContext.Provider>
            ) : (
              <MobileDocumentView
                workspaceRoot={workspace.root}
                documentId={documentId}
              />
            )}
          </div>
        ) : (
          <div className="mobile-shell-empty">
            <p>从导图或目录打开一篇文档。</p>
          </div>
        )}
      </div>

      <nav className="mobile-tabbar" aria-label="移动导航">
        <button
          type="button"
          className={tab === "map" ? "active" : ""}
          aria-current={tab === "map" ? "page" : undefined}
          onClick={() => switchTab("map")}
        >
          导图
        </button>
        <button
          type="button"
          className={tab === "library" ? "active" : ""}
          aria-current={tab === "library" ? "page" : undefined}
          onClick={() => switchTab("library")}
        >
          目录
        </button>
        <button
          type="button"
          className={tab === "document" ? "active" : ""}
          aria-current={tab === "document" ? "page" : undefined}
          onClick={() => switchTab("document")}
          disabled={!documentId}
        >
          文档
        </button>
        <button
          type="button"
          onClick={() => {
            requestSave();
            window.dispatchEvent(new Event("settings:open"));
          }}
        >
          设置
        </button>
      </nav>
    </div>
  );
}
