import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapService } from "../application/mapService";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import type { MindMapNode, MindMapView } from "../types";
import { buildMindMap, flattenMindMap } from "../lib/mindMap";
import MindMapNodeView from "./MindMapNode";

const nodeTypes = { mindMap: MindMapNodeView };

type ContextMenuState = {
  x: number;
  y: number;
  node: MindMapNode;
};

function replacePosition(
  node: MindMapNode,
  id: string,
  x: number,
  y: number,
): MindMapNode {
  return {
    ...node,
    positionX: node.id === id ? x : node.positionX,
    positionY: node.id === id ? y : node.positionY,
    children: node.children.map((child) =>
      replacePosition(child, id, x, y),
    ),
  };
}

function MindMapInner({
  workspaceRoot,
  mapId,
  mapTitle,
  selectedId,
  onOpenDocument,
}: {
  workspaceRoot: string;
  mapId: string;
  mapTitle: string;
  selectedId: string | null;
  onOpenDocument: (documentId: string) => void;
}) {
  const { fitView } = useReactFlow();
  const [map, setMap] = useState<MindMapView | null>(null);
  const [activeId, setActiveId] = useState<string | null>(selectedId);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const view = await mapService.loadMap(workspaceRoot, mapId);
      setMap(view);
      setError(null);
    } catch (reason) {
      setError(String(reason));
    }
  }, [workspaceRoot, mapId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load();
    };
    window.addEventListener("tauri-notes:blocks-saved", handler);
    window.addEventListener("tauri-notes:document-changed", handler);
    return () => {
      window.removeEventListener("tauri-notes:blocks-saved", handler);
      window.removeEventListener("tauri-notes:document-changed", handler);
    };
  }, [load]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".mind-map-menu")) {
        setMenu(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ documentId?: string }>
      ).detail;
      if (detail?.documentId) {
        onOpenDocument(detail.documentId);
      }
    };
    window.addEventListener("mind-map:open-document", handler);
    return () =>
      window.removeEventListener("mind-map:open-document", handler);
  }, [onOpenDocument]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.25, duration: 220 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [map?.root.id, fitView]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) {
      return;
    }
    let lastWidth = 0;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 80 && width !== lastWidth) {
        lastWidth = width;
        requestAnimationFrame(() => {
          void fitView({ padding: 0.25 });
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitView]);

  const graph = useMemo(
    () => buildMindMap(
      map?.root ?? {
        id: `map:${mapId}`,
        title: mapTitle,
        hasDocument: false,
        documentId: null,
        headingBlockId: null,
        positionX: 0,
        positionY: 0,
        children: [],
      },
      activeId,
      (nodeId, title) => {
        if (nodeId.startsWith("map:")) {
          void mapService
            .renameMap(workspaceRoot, mapId, title)
            .then(() => {
            window.dispatchEvent(
              new CustomEvent("tauri-notes:map-renamed", {
                detail: { mapId, title },
              }),
            );
            window.dispatchEvent(new CustomEvent("tauri-notes:maps-changed"));
            void load();
          });
          return;
        }
        void mapService
          .renameNode(workspaceRoot, nodeId, title)
          .then(() => {
          const documentId = map
            ? flattenMindMap(map.root).find((node) => node.id === nodeId)
                ?.documentId
            : null;
          if (documentId) {
            window.dispatchEvent(
              new CustomEvent("tauri-notes:document-renamed", {
                detail: { documentId, title },
              }),
            );
          }
          window.dispatchEvent(new CustomEvent("tauri-notes:maps-changed"));
          void load();
        });
      },
    ),
    [map, mapId, mapTitle, activeId, workspaceRoot, load],
  );

  const byId = useMemo(
    () =>
      new Map(
        (map ? flattenMindMap(map.root) : []).map((node) => [node.id, node]),
      ),
    [map],
  );

  const onNodeClick: NodeMouseHandler = (_, node) => {
    const target = byId.get(node.id);
    if (!target) {
      return;
    }
    setActiveId(target.id);
  };

  const onNodeContextMenu: NodeMouseHandler = (event, node) => {
    event.preventDefault();
    const target = byId.get(node.id);
    if (!target) {
      return;
    }
    setActiveId(target.id);
    setMenu({ x: event.clientX, y: event.clientY, node: target });
  };

  const onNodeDragStop: OnNodeDrag = (_, node) => {
    if (node.id.startsWith("map:")) {
      return;
    }
    setMap((current) =>
      current
        ? {
            ...current,
            root: replacePosition(
              current.root,
              node.id,
              node.position.x,
              node.position.y,
            ),
          }
        : current,
    );
    void mapService
      .setNodePosition(
        workspaceRoot,
        node.id,
        node.position.x,
        node.position.y,
      )
      .catch((reason) => setError(String(reason)));
  };

  const onNodeDrag: OnNodeDrag = (_, node) => {
    if (node.id.startsWith("map:")) {
      return;
    }
    setMap((current) =>
      current
        ? {
            ...current,
            root: replacePosition(
              current.root,
              node.id,
              node.position.x,
              node.position.y,
            ),
          }
        : current,
    );
  };

  const renameNodeInline = () => {
    if (!menu) {
      return;
    }
    const nodeId = menu.node.id;
    setMenu(null);
    window.dispatchEvent(
      new CustomEvent("mind-map:rename", { detail: { nodeId } }),
    );
  };

  const deleteNode = async () => {
    if (!menu || menu.node.id.startsWith("map:")) {
      return;
    }
    const node = menu.node;
    setMenu(null);
    if (
      !window.confirm(
        `删除节点“${node.title}”？\n如果它绑定了文档，文档会移动到“未归类”。`,
      )
    ) {
      return;
    }
    try {
      await mapService.deleteNode(workspaceRoot, node.id);
      window.dispatchEvent(new CustomEvent("tauri-notes:maps-changed"));
      await load();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const createRootDocument = async () => {
    setMenu(null);
    try {
      const documentId = await mapService.createDocumentForRoot(
        workspaceRoot,
        mapId,
      );
      await load();
      onOpenDocument(documentId);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const createChild = async () => {
    if (!menu) {
      return;
    }
    const title = window.prompt("新节点名称");
    setMenu(null);
    if (!title?.trim()) {
      return;
    }
    try {
      await mapService.createNode({
        workspace: workspaceRoot,
        mapId,
        parentId: menu.node.id.startsWith("map:") ? null : menu.node.id,
        title: title.trim(),
      });
      await load();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const createDocument = async () => {
    if (!menu) {
      return;
    }
    const node = menu.node;
    setMenu(null);
    try {
      const updated = await mapService.createDocumentForNode(
        workspaceRoot,
        node.id,
      );
      await load();
      if (updated.documentId) {
        onOpenDocument(updated.documentId);
      }
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (!map) {
    return (
      <div className="mind-map">
        <div className="mind-map-empty">
          {error ? `导图加载失败：${error}` : "加载导图…"}
        </div>
      </div>
    );
  }

  return (
    <div className="mind-map" ref={mapRef}>
      {error && <div className="mind-map-error">{error}</div>}
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        onInit={(instance) => {
          window.setTimeout(() => {
            void instance.fitView({ padding: 0.25, duration: 200 });
          }, 300);
        }}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={onNodeClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={() => setMenu(null)}
        minZoom={0.2}
        maxZoom={1.8}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
        className="mind-map-flow"
      >
        <Background color="var(--map-dot)" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="var(--map-node-border)"
          maskColor="var(--map-minimap-mask)"
        />
      </ReactFlow>
      {menu && (
        <div
          className="mind-map-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {!menu.node.id.startsWith("map:") &&
            (menu.node.documentId ? (
              <button
                type="button"
                onClick={() => {
                  onOpenDocument(menu.node.documentId!);
                  setMenu(null);
                }}
              >
                打开文档
              </button>
            ) : (
              <button type="button" onClick={() => void createDocument()}>
                创建文档
              </button>
            ))}
          {menu.node.id.startsWith("map:") &&
            (menu.node.hasDocument && menu.node.documentId ? (
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  if (menu.node.documentId) {
                    onOpenDocument(menu.node.documentId);
                  }
                }}
              >
                打开文档
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void createRootDocument()}
              >
                插入文档
              </button>
            ))}
          <button type="button" onClick={() => void createChild()}>
            新建子节点
          </button>
          <button type="button" onClick={renameNodeInline}>
            重命名
          </button>
          {!menu.node.id.startsWith("map:") && (
            <button type="button" onClick={() => void deleteNode()}>
              删除节点…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MindMap({
  workspaceRoot,
  mapId,
  mapTitle,
  selectedId,
  onOpenDocument,
}: {
  workspaceRoot: string;
  mapId: string;
  mapTitle: string;
  selectedId: string | null;
  onOpenDocument: (documentId: string) => void;
}) {
  return (
    <div className="mind-map">
      <ReactFlowProvider>
        <MindMapInner
          workspaceRoot={workspaceRoot}
          mapId={mapId}
          mapTitle={mapTitle}
          selectedId={selectedId}
          onOpenDocument={onOpenDocument}
        />
      </ReactFlowProvider>
    </div>
  );
}
