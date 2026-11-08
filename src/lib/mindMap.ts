import type { Edge, Node } from "@xyflow/react";
import type { MindMapNode } from "../types";
import type { MindMapNodeData } from "../components/MindMapNode";

const X_GAP = 64;
const Y_GAP = 20;
const NODE_HEIGHT = 44;
const ROOT_HEIGHT = 52;
const MIN_WIDTH = 110;

function nodeWidth(node: MindMapNode, isRoot: boolean): number {
  const content = [...node.title].reduce(
    (total, character) =>
      total + (/[\u3000-\u9fff\uff00-\uffef]/.test(character) ? 13 : 7.4),
    0,
  );
  return Math.max(
    isRoot ? 150 : MIN_WIDTH,
    Math.ceil(content + (node.hasDocument ? 46 : 28) + 16),
  );
}

/**
 * Left-to-right mind-map layout. Leaves advance the vertical cursor; a parent
 * sits at the midpoint of its first and last child. Saved positions remain
 * manual unless `ignoreManual` is requested by the arrange action.
 */
export function buildMindMap(
  root: MindMapNode,
  selectedId: string | null,
  onRename: (nodeId: string, title: string) => void,
  options: { ignoreManual?: boolean } = {},
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  const nodes: Node<MindMapNodeData>[] = [];
  const edges: Edge[] = [];
  let cursorY = 0;

  function place(node: MindMapNode, x: number, isRoot = false): number {
    const width = nodeWidth(node, isRoot);
    const height = isRoot ? ROOT_HEIGHT : NODE_HEIGHT;
    let centerY: number;

    if (node.children.length === 0) {
      centerY = cursorY + height / 2;
      cursorY += height + Y_GAP;
    } else {
      const childX = x + width + X_GAP;
      const childCenters = node.children.map((child) =>
        place(child, childX),
      );
      centerY =
        (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    }

    const manual = !options.ignoreManual && node.positionSaved;
    const nodeX = manual ? node.positionX : x;
    const nodeY = manual ? node.positionY : centerY - height / 2;

    nodes.push({
      id: node.id,
      position: { x: nodeX, y: nodeY },
      data: {
        label: node.title,
        hasDocument: node.hasDocument,
        documentId: node.documentId,
        isRoot,
        selected: node.id === selectedId,
        nodeId: node.id,
        nodeTitle: node.title,
        onRename,
      },
      type: "mindMap",
      draggable: true,
      style: {
        width,
        height,
        boxSizing: "border-box",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${
          node.id === selectedId
            ? "var(--map-node-border-selected)"
            : isRoot
              ? "var(--map-root-border)"
              : "var(--map-node-border)"
        }`,
        background:
          node.id === selectedId
            ? "var(--map-node-bg-selected)"
            : isRoot
              ? "var(--map-root-bg)"
              : "var(--map-node-bg)",
        color: "var(--map-node-text)",
        fontSize: 13,
        fontWeight: isRoot ? 600 : 400,
        whiteSpace: "nowrap",
      },
    });

    for (const child of node.children) {
      edges.push({
        id: `${node.id}->${child.id}`,
        source: node.id,
        target: child.id,
        type: "default",
        style: { stroke: "#43516b", strokeWidth: 1.5 },
      });
    }

    return centerY;
  }

  place(root, 0, true);
  return { nodes, edges };
}

export function flattenMindMap(root: MindMapNode): MindMapNode[] {
  return [root, ...root.children.flatMap(flattenMindMap)];
}