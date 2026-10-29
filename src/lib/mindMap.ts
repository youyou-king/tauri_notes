import type { Edge, Node } from "@xyflow/react";
import type { MindMapNode } from "../types";
import type { MindMapNodeData } from "../components/MindMapNode";

const X_GAP = 48;
const Y_GAP = 132;
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

export function buildMindMap(
  root: MindMapNode,
  selectedId: string | null,
  onRename: (nodeId: string, title: string) => void,
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  const nodes: Node<MindMapNodeData>[] = [];
  const edges: Edge[] = [];
  let cursor = 0;

  function place(node: MindMapNode, depth: number, isRoot = false): number {
    const width = nodeWidth(node, isRoot);
    const childCenters = node.children.map((child) => place(child, depth + 1));
    const manual = node.positionX !== 0 || node.positionY !== 0;

    let center: number;
    let x: number;
    if (node.children.length > 0) {
      center =
        (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
      x = center - width / 2;
    } else {
      x = cursor;
      cursor += width + X_GAP;
      center = x + width / 2;
    }

    if (manual) {
      x = node.positionX;
      center = x + width / 2;
    }
    if (isRoot && !manual) {
      center =
        childCenters.length > 0
          ? (childCenters[0] + childCenters[childCenters.length - 1]) / 2
          : 0;
      x = center - width / 2;
    }
    const y = manual ? node.positionY : isRoot ? 0 : depth * Y_GAP;

    nodes.push({
      id: node.id,
      position: { x, y },
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

    return center;
  }

  place(root, 0, true);
  return { nodes, edges };
}

export function flattenMindMap(root: MindMapNode): MindMapNode[] {
  return [root, ...root.children.flatMap(flattenMindMap)];
}
