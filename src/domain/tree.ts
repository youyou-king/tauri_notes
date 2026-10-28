import type { NodeView } from "../types";

export function findNode(node: NodeView, id: string): NodeView | null {
  if (node.id === id) {
    return node;
  }
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}
