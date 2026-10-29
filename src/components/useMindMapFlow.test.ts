import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { MindMapNode } from "../types";
import { buildMindMap } from "../lib/mindMap";
import { reconcileFlowNodes } from "./useMindMapFlow";
import type { MindMapNodeData } from "./MindMapNode";

function node(
  id: string,
  x: number,
  y: number,
  label = id,
): Node<MindMapNodeData> {
  return {
    id,
    type: "mindMap",
    position: { x, y },
    data: {
      label,
      hasDocument: false,
      documentId: null,
      isRoot: false,
      selected: false,
      nodeId: id,
      nodeTitle: label,
      onRename: () => undefined,
    },
  };
}

describe("mind map flow reconciliation", () => {
  it("keeps live positions and takes data updates from layout", () => {
    const live = node("a", 12, 34, "旧标题");
    const merged = reconcileFlowNodes(
      [live],
      [node("a", 120, 340, "新标题"), node("b", 220, 440)],
    );

    expect(merged[0].position).toEqual({ x: 12, y: 34 });
    expect(merged[0].data.label).toBe("新标题");
    expect(merged[1].position).toEqual({ x: 220, y: 440 });
  });

  it("treats a saved horizontal position as manual layout", () => {
    const root: MindMapNode = {
      id: "map:test",
      title: "测试",
      hasDocument: false,
      documentId: null,
      headingBlockId: null,
      positionX: 0,
      positionY: 0,
      children: [
        {
          id: "child",
          title: "子节点",
          hasDocument: false,
          documentId: null,
          headingBlockId: null,
          positionX: 180,
          positionY: 0,
          children: [],
        },
      ],
    };

    const graph = buildMindMap(root, null, () => undefined);
    expect(
      graph.nodes.find((item) => item.id === "child")?.position,
    ).toEqual({ x: 180, y: 0 });
  });

  it("persists a manually moved root position", () => {
    const root: MindMapNode = {
      id: "map:test",
      title: "测试",
      hasDocument: false,
      documentId: null,
      headingBlockId: null,
      positionX: 40,
      positionY: 60,
      children: [],
    };

    const graph = buildMindMap(root, null, () => undefined);
    expect(graph.nodes[0].position).toEqual({ x: 40, y: 60 });
    expect(graph.nodes[0].draggable).toBe(true);
  });
});
