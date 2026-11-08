import { useEffect, useRef } from "react";
import { useNodesState, type Node } from "@xyflow/react";
import type { MindMapNodeData } from "./MindMapNode";

/**
 * Reconciles a freshly laid-out graph with the live React Flow state.
 *
 * Layout is a one-time placement hint: existing nodes keep their live
 * positions, while new nodes get the layout position. Drag updates are owned
 * by React Flow and never write back to the domain model until drag stop.
 * An explicit `revision` reset is used by the arrange action, which must
 * override live positions with a freshly computed layout.
 */
export function reconcileFlowNodes(
  current: Node<MindMapNodeData>[],
  layout: Node<MindMapNodeData>[],
): Node<MindMapNodeData>[] {
  const byId = new Map(current.map((node) => [node.id, node]));
  return layout.map((next) => {
    const existing = byId.get(next.id);
    if (!existing) {
      return next;
    }
    return {
      ...next,
      position: existing.position,
      measured: existing.measured,
      width: existing.width,
      height: existing.height,
    };
  });
}

export function useMindMapFlow(
  layout: Node<MindMapNodeData>[],
  revision = 0,
) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<MindMapNodeData>>(layout);
  const previousRevision = useRef(revision);

  useEffect(() => {
    if (previousRevision.current !== revision) {
      previousRevision.current = revision;
      setNodes(layout);
      return;
    }
    setNodes((current) => reconcileFlowNodes(current, layout));
  }, [layout, revision, setNodes]);

  return { nodes, onNodesChange };
}
