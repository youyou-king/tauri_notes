import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import type { MindMapNode } from "../../types";
import { PanelIcon } from "../design-system/PanelIcon";

export type OutlineDragDrop = {
  accepts: (types: readonly string[]) => boolean;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
};

/**
 * Shared outline row. Desktop supplies a Dockview drag adapter; mobile can
 * omit drag/drop entirely without pulling panel infrastructure into the tree.
 */
export function OutlineTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onOpenDocument,
  onRenameDocument,
  onMenu,
  dragDrop,
  activeDocumentId,
}: {
  node: MindMapNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpenDocument: (documentId: string) => void;
  onRenameDocument: (node: MindMapNode, title: string) => void;
  onMenu?: (node: MindMapNode) => void;
  dragDrop?: OutlineDragDrop;
  activeDocumentId: string | null;
}) {
  const [dropActive, setDropActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const openTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
      }
    };
  }, []);

  const hasChildren = node.children.length > 0;
  const open = expanded.has(node.id) || !hasChildren;

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== node.title) {
      onRenameDocument(node, next);
    } else {
      setDraft(node.title);
    }
  };

  return (
    <div className="outline-branch">
      <div
        className={`tree-row outline-node ${
          node.hasDocument ? "document" : "idea"
        } ${node.documentId === activeDocumentId ? "selected" : ""} ${
          dropActive ? "drop-target" : ""
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onDragOver={
          dragDrop
            ? (event) => {
                if (dragDrop.accepts(Array.from(event.dataTransfer.types))) {
                  event.preventDefault();
                  setDropActive(true);
                }
              }
            : undefined
        }
        onDragLeave={dragDrop ? () => setDropActive(false) : undefined}
        onDrop={
          dragDrop
            ? (event) => {
                event.preventDefault();
                setDropActive(false);
                dragDrop.onDrop(event);
              }
            : undefined
        }
      >
        <button
          type="button"
          className="tree-caret-button"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) {
              onToggle(node.id);
            }
          }}
          aria-label={open ? "收起" : "展开"}
        >
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </button>
        <span className="outline-icon">
          <PanelIcon icon={node.hasDocument ? "📄" : "💡"} />
        </span>
        {editing ? (
          <input
            autoFocus
            className="tree-label-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commit();
              } else if (event.key === "Escape") {
                setDraft(node.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="tree-label"
            title={node.hasDocument ? "打开文档" : "纯想法节点"}
            onClick={() => {
              if (node.hasDocument && node.documentId) {
                if (openTimer.current !== null) {
                  window.clearTimeout(openTimer.current);
                }
                const documentId = node.documentId;
                openTimer.current = window.setTimeout(() => {
                  openTimer.current = null;
                  onOpenDocument(documentId);
                }, 220);
              } else if (hasChildren) {
                onToggle(node.id);
              }
            }}
            onDoubleClick={() => {
              if (openTimer.current !== null) {
                window.clearTimeout(openTimer.current);
                openTimer.current = null;
              }
              setDraft(node.title);
              setEditing(true);
            }}
          >
            {node.title}
          </button>
        )}
        {onMenu && node.hasDocument && (
          <button
            type="button"
            className="outline-node-menu"
            aria-label={`文档操作 ${node.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onMenu(node);
            }}
          >
            ⋯
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div className="tree-children">
          {node.children.map((child) => (
            <OutlineTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpenDocument={onOpenDocument}
              onRenameDocument={onRenameDocument}
              onMenu={onMenu}
              dragDrop={dragDrop}
              activeDocumentId={activeDocumentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}