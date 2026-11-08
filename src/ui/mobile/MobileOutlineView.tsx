import { useEffect, useState } from "react";
import { mapService } from "../../application/mapService";
import { APP_EVENTS, emitAppEvent, onAppEvent } from "../../kernel/events";
import type { LibraryId, MindMapNode, MindMapView } from "../../types";
import { StateView } from "../design-system/StateView";
import { SurfaceHeader } from "../design-system/SurfaceHeader";
import { OutlineTreeNode } from "../outline/OutlineTreeNode";

function collectNodeIds(node: MindMapNode, output: Set<string>): void {
  output.add(node.id);
  node.children.forEach((child) => collectNodeIds(child, output));
}

/**
 * Mobile outline for the active map. It reuses the desktop outline tree but
 * deliberately does not depend on Dockview/PanelContext or cross-panel drag.
 */
export function MobileOutlineView({
  libraryId,
  mapId,
  mapTitle,
  activeDocumentId,
  onOpenDocument,
  onDocumentMenu,
}: {
  libraryId: LibraryId;
  mapId: string;
  mapTitle: string;
  activeDocumentId: string | null;
  onOpenDocument: (documentId: string) => void;
  onDocumentMenu: (documentId: string, title: string) => void;
}) {
  const [map, setMap] = useState<MindMapView | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void mapService
        .loadOutline(libraryId)
        .then((outline) => {
          if (cancelled) {
            return;
          }
          const next = outline.maps.find((item) => item.id === mapId) ?? null;
          setMap(next);
          if (next) {
            const ids = new Set<string>();
            next.root.children.forEach((node) => collectNodeIds(node, ids));
            setExpanded((current) => {
              if (current.size === 0) {
                return ids;
              }
              const preserved = new Set(
                [...current].filter((id) => ids.has(id)),
              );
              return preserved.size > 0 ? preserved : ids;
            });
          }
          setError(null);
        })
        .catch((reason) => {
          if (!cancelled) {
            setError(String(reason));
          }
        });
    };
    load();
    const unsubscribers = [
      onAppEvent(APP_EVENTS.blocksSaved, load),
      onAppEvent(APP_EVENTS.documentChanged, load),
      onAppEvent(APP_EVENTS.mapsChanged, load),
    ];
    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [libraryId, mapId]);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renameDocumentNode = async (
    node: MindMapNode,
    title: string,
  ) => {
    try {
      await mapService.renameNode(libraryId, node.id, title);
      if (node.documentId) {
        emitAppEvent(APP_EVENTS.documentRenamed, {
          documentId: node.documentId,
          title,
        });
      }
      emitAppEvent(APP_EVENTS.mapsChanged);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <div className="mobile-outline-view">
      <SurfaceHeader
        className="mobile-outline-header"
        title={map?.title ?? mapTitle}
        subtitle="大纲"
        actions={
          <span>{map ? `${map.root.children.length} 个节点` : ""}</span>
        }
      />
      {error && <p className="theme-error">{error}</p>}
      {!map ? (
        <StateView className="mobile-shell-empty" detail="正在读取大纲…" />
      ) : map.root.children.length === 0 ? (
        <StateView
          className="mobile-shell-empty"
          detail="当前导图还没有节点。"
        />
      ) : (
        <div className="mobile-outline-tree" role="tree" aria-label="导图大纲">
          {map.root.children.map((node) => (
            <OutlineTreeNode
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              onOpenDocument={onOpenDocument}
              onRenameDocument={(target, title) => {
                void renameDocumentNode(target, title);
              }}
              onMenu={(target) => {
                if (target.documentId) {
                  onDocumentMenu(target.documentId, target.title);
                }
              }}
              activeDocumentId={activeDocumentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}