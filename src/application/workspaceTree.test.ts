import { describe, expect, it } from "vitest";
import type { WorkspaceView } from "../types";
import type { DatabaseTreeNode } from "./workspaceService";
import { buildDatabaseTree, mergeDatabaseDocuments } from "./workspaceTree";

const view: WorkspaceView = {
  root: "C:/demo.note",
  title: "Demo",
  maps: [
    {
      id: "map-1",
      title: "Map",
      root: { id: "root", title: "Map", hasDocument: false, children: [] },
    },
  ],
};

const row = (
  documentId: string,
  parentId: string | null,
  title: string,
): DatabaseTreeNode => ({
  mapId: "map-1",
  documentId,
  parentId,
  title,
  orderKey: "00000000",
});

describe("workspaceTree", () => {
  it("merges documents that are not already in the map", () => {
    const merged = mergeDatabaseDocuments(view, [
      { id: "map-1/doc-1", title: "Doc 1" },
      { id: "map-1/doc-2", title: "Doc 2" },
    ]);
    expect(merged.maps[0].root.children.map((node) => node.id)).toEqual([
      "doc-1",
      "doc-2",
    ]);
    expect(merged.maps[0].root.children[0].hasDocument).toBe(true);
  });

  it("builds a nested tree from database rows", () => {
    const built = buildDatabaseTree(view, [
      row("map-1/a", null, "A"),
      row("map-1/b", "map-1/a", "B"),
    ]);
    expect(built.maps[0].root.id).toBe("a");
    expect(built.maps[0].root.children[0].id).toBe("b");
  });

  it("keeps the existing root when there are no rows for a map", () => {
    const built = buildDatabaseTree(view, []);
    expect(built.maps[0].root.id).toBe("root");
  });
});
