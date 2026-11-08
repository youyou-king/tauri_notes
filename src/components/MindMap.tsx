import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_EVENTS, emitAppEvent, onAppEvent } from "../kernel/events";
import { mapService } from "../application/mapService";
import { confirmDialog, promptDialog } from "../ui/dialog/appDialog";
import { StateView } from "../ui/design-system/StateView";
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
import type { LibraryId, MindMapNode, MindMapView } from "../types";
import { buildMindMap, flattenMindMap } from "../lib/mindMap";
import MindMapNodeView from "./MindMapNode";
import { useMindMapFlow } from "./useMindMapFlow";
import { ContextMenu, type ContextMenuItem } from "../ui/menu/ContextMenu";
import {
  readMapViewport,
  writeMapViewport,
} from "../application/stores/mapViewportStore";

const nodeTypes = { mindMap: MindMapNodeView };

type ContextMenuState = {
  x: number;
  y: number;
  node: MindMapNode;
};

function replacePositions(
  node: MindMapNode,
  positions: Map<string, { x: number; y: number }>,
): MindMapNode {
  const position = positions.get(node.id);
  return {
    ...node,
    positionX: position?.x ?? node.positionX,
    positionY: position?.y ?? node.positionY,
    positionSaved: position ? true : node.positionSaved,
    children: node.children.map((child) =>
      replacePositions(child, positions),
    ),
  };
}

function MindMapInner({
  libraryId,
  mapId,
  mapTitle,
  selectedId,
  onOpenDocument,
}: {
  libraryId: LibraryId;
  mapId: string;
  mapTitle: string;
  selectedId: string | null;
  onOpenDocument: (documentId: string) => void;
}) {
  const { fitView, setViewport } = useReactFlow();
  const [map, setMap] = useState<MindMapView | null>(null);
  const [activeId, setActiveId] = useState<string | null>(selectedId);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const view = await mapService.loadMap(libraryId, mapId);
      setMap(view);
      setError(null);
    } catch (reason) {
      setError(String(reason));
    }
  }, [libraryId, mapId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load();
    };
    const unsubscribers = [
      onAppEvent(APP_EVENTS.blocksSaved, handler),
      onAppEvent(APP_EVENTS.documentChanged, handler),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [load]);

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
    const saved = readMapViewport(libraryId, mapId);
    const timer = window.setTimeout(() => {
      if (saved) {
        void setViewport(saved);
      } else {
        void fitView({ padding: 0.25, duration: 220 });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [map?.root.id, fitView, libraryId, mapId, setViewport]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) {
      return;
    }
    let lastWidth = 0;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (
        width > 80 &&
        width !== lastWidth &&
        !readMapViewport(libraryId, mapId)
      ) {
        lastWidth = width;
        requestAnimationFrame(() => {
          void fitView({ padding: 0.25 });
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitView, libraryId, mapId]);

  const graph = useMemo(
    () => {
      if (!map) {
        return { nodes: [], edges: [] };
      }
      return buildMindMap(
        map.root,
        activeId,
        (nodeId, title) => {
          if (nodeId.startsWith("map:")) {
            void mapService
              .renameMap(libraryId, mapId, title)
              .then(() => {
                emitAppEvent(APP_EVENTS.mapRenamed, { mapId, title });
                emitAppEvent(APP_EVENTS.mapsChanged);
                void load();
              });
            return;
          }
          void mapService
            .renameNode(libraryId, nodeId, title)
            .then(() => {
              const documentId = map
                ? flattenMindMap(map.root).find(
                    (node) => node.id === nodeId,
                  )?.documentId
                : null;
              if (documentId) {
                emitAppEvent(APP_EVENTS.documentRenamed, {
                  documentId,
                  title,
                });
              }
              emitAppEvent(APP_EVENTS.mapsChanged);
              void load();
            });
        },
      );
    },
    [map, mapId, activeId, libraryId, load],
  );

  const byId = useMemo(
    () =>
      new Map(
        (map ? flattenMindMap(map.root) : []).map((node) => [node.id, node]),
      ),
    [map],
  );

  const { nodes: flowNodes, onNodesChange } = useMindMapFlow(
    graph.nodes,
    layoutRevision,
  );

  const arrangeLayout = async () => {
    if (!map || arranging) {
      return;
    }
    setArranging(true);
    setError(null);
    const laidOut = buildMindMap(
      map.root,
      activeId,
      () => undefined,
      { ignoreManual: true },
    );
    const positions = new Map(
      laidOut.nodes.map((node) => [node.id, node.position]),
    );
    try {
      await mapService.setNodePositions(
        libraryId,
        [...positions].map(([nodeId, position]) => ({
          nodeId,
          x: position.x,
          y: position.y,
        })),
      );
      setMap((current) =>
        current
          ? {
              ...current,
              root: replacePositions(current.root, positions),
            }
          : current,
      );
      setLayoutRevision((current) => current + 1);
      window.setTimeout(() => {
        void fitView({ padding: 0.25, duration: 260 });
      }, 0);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setArranging(false);
    }
  };

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
    const positions = new Map(
      flowNodes.map((item) => [item.id, item.position] as const),
    );
    positions.set(node.id, node.position);
    setMap((current) =>
      current
        ? {
            ...current,
            root: replacePositions(current.root, positions),
          }
        : current,
    );
    // Persist the whole visible layout, not only the dragged node. Otherwise
    // every untouched node falls back to auto-layout on the next open and the
    // manually arranged map appears to "jump" again.
    void mapService
      .setNodePositions(
        libraryId,
        [...positions].map(([nodeId, position]) => ({
          nodeId,
          x: position.x,
          y: position.y,
        })),
      )
      .catch((reason) => setError(String(reason)));
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
      !(await confirmDialog({
        title: "删除节点？",
        message: `删除节点“${node.title}”？如果它绑定了文档，文档会移动到“未归类”。`,
        confirmLabel: "删除",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await mapService.deleteNode(libraryId, node.id);
      emitAppEvent(APP_EVENTS.mapsChanged);
      await load();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const createRootDocument = async () => {
    setMenu(null);
    try {
      const documentId = await mapService.createDocumentForRoot(
        libraryId,
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
    const title = await promptDialog({ title: "新节点名称" });
    setMenu(null);
    if (!title?.trim()) {
      return;
    }
    try {
      await mapService.createNode({
        libraryId,
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
        libraryId,
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

  const menuItems: ContextMenuItem[] = menu
    ? [
        ...(menu.node.id.startsWith("map:")
          ? menu.node.hasDocument && menu.node.documentId
            ? [
                {
                  id: "open-document",
                  label: "打开文档",
                  onSelect: () => {
                    if (menu.node.documentId) {
                      onOpenDocument(menu.node.documentId);
                    }
                  },
                },
              ]
            : [
                {
                  id: "create-root-document",
                  label: "插入文档",
                  onSelect: () => void createRootDocument(),
                },
              ]
          : menu.node.documentId
            ? [
                {
                  id: "open-document",
                  label: "打开文档",
                  onSelect: () => {
                    if (menu.node.documentId) {
                      onOpenDocument(menu.node.documentId);
                    }
                  },
                },
              ]
            : [
                {
                  id: "create-document",
                  label: "创建文档",
                  onSelect: () => void createDocument(),
                },
              ]),
        {
          id: "create-child",
          label: "新建子节点",
          onSelect: () => void createChild(),
        },
        {
          id: "rename-node",
          label: "重命名",
          onSelect: renameNodeInline,
        },
        ...(!menu.node.id.startsWith("map:")
          ? [
              {
                id: "delete-node",
                label: "删除节点…",
                danger: true,
                separatorBefore: true,
                onSelect: () => void deleteNode(),
              },
            ]
          : []),
      ]
    : [];

  if (!map) {
    return (
      <div className="mind-map">
        <StateView
          className="mind-map-empty"
          tone={error ? "error" : "loading"}
          detail={error ? `导图加载失败：${error}` : `加载 ${mapTitle}…`}
        />
      </div>
    );
  }

  return (
    <div className="mind-map" ref={mapRef}>
      {error && <div className="mind-map-error">{error}</div>}
      <button
        type="button"
        className="mind-map-arrange"
        aria-label="整理导图布局"
        title="整理导图布局"
        disabled={arranging}
        onClick={() => void arrangeLayout()}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2" y="7.5" width="5" height="5" rx="1.2" />
          <rect x="13" y="2" width="5" height="5" rx="1.2" />
          <rect x="13" y="13" width="5" height="5" rx="1.2" />
          <path d="M7 10h3M10 4.5v11M10 4.5h3M10 15.5h3" />
        </svg>
      </button>
      <ReactFlow
        nodes={flowNodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onMoveEnd={(_, viewport) => {
          writeMapViewport(libraryId, mapId, viewport);
        }}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={onNodeClick}
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
        <ContextMenu
          position={{ x: menu.x, y: menu.y }}
          items={menuItems}
          onClose={() => setMenu(null)}
          label="节点菜单"
        />
      )}
    </div>
  );
}

export default function MindMap({
  libraryId,
  mapId,
  mapTitle,
  selectedId,
  onOpenDocument,
}: {
  libraryId: LibraryId;
  mapId: string;
  mapTitle: string;
  selectedId: string | null;
  onOpenDocument: (documentId: string) => void;
}) {
  return (
    <div className="mind-map">
      <ReactFlowProvider>
        <MindMapInner
          libraryId={libraryId}
          mapId={mapId}
          mapTitle={mapTitle}
          selectedId={selectedId}
          onOpenDocument={onOpenDocument}
        />
      </ReactFlowProvider>
    </div>
  );
}
