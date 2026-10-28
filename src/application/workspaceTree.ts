import type { DatabaseTreeNode } from "./workspaceService";
import type { NodeView, WorkspaceView } from "../types";

function collectNodeIds(node: NodeView, ids: Set<string>) {
  ids.add(node.id);
  node.children.forEach((child) => collectNodeIds(child, ids));
}

export function mergeDatabaseDocuments(
  view: WorkspaceView,
  documents: Array<{ id: string; title: string }>,
): WorkspaceView {
  return {
    ...view,
    maps: view.maps.map((map) => {
      const ids = new Set<string>();
      collectNodeIds(map.root, ids);
      const extras = documents
        .filter((document) => document.id.startsWith(`${map.id}/`))
        .map((document) => ({
          nodeId: document.id.slice(map.id.length + 1),
          title: document.title,
        }))
        .filter((entry) => entry.nodeId && !ids.has(entry.nodeId))
        .map((entry) => ({
          id: entry.nodeId,
          title: entry.title,
          hasDocument: true,
          children: [],
        }));
      if (extras.length === 0) {
        return map;
      }
      return {
        ...map,
        root: {
          ...map.root,
          children: [...map.root.children, ...extras],
        },
      };
    }),
  };
}

export function buildDatabaseTree(
  view: WorkspaceView,
  rows: DatabaseTreeNode[],
): WorkspaceView {
  return {
    ...view,
    maps: view.maps.map((map) => {
      const entries = rows.filter((row) => row.mapId === map.id);
      if (entries.length === 0) {
        return map;
      }
      const byParent = new Map<string | null, DatabaseTreeNode[]>();
      entries.forEach((entry) => {
        const parent = entry.parentId ?? null;
        byParent.set(parent, [...(byParent.get(parent) ?? []), entry]);
      });
      const visited = new Set<string>();
      const toNode = (entry: DatabaseTreeNode): NodeView => {
        visited.add(entry.documentId);
        const children = (byParent.get(entry.documentId) ?? [])
          .filter((child) => !visited.has(child.documentId))
          .map(toNode);
        return {
          id: entry.documentId.slice(map.id.length + 1),
          title: entry.title,
          hasDocument: true,
          children,
        };
      };
      const roots = byParent.get(null) ?? [];
      const candidates =
        roots.length > 0
          ? roots
          : entries.filter(
              (entry) =>
                !entry.parentId ||
                !entries.some(
                  (parent) => parent.documentId === entry.parentId,
                ),
            );
      if (candidates.length === 0) {
        return map;
      }
      const root = toNode(candidates[0]);
      if (candidates.length > 1) {
        root.children.push(...candidates.slice(1).map(toNode));
      }
      return { ...map, root };
    }),
  };
}
