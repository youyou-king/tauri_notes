import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { MindMapNode } from "../../../src/types";
import { buildMindMap } from "../../../src/lib/mindMap";
import { reconcileFlowNodes } from "../../../src/components/useMindMapFlow";
import type { MindMapNodeData } from "../../../src/components/MindMapNode";

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

  it("lays out children left-to-right by default", () => {
    const root: MindMapNode = {
      id: "map:test",
      title: "测试",
      hasDocument: false,
      documentId: null,
      headingBlockId: null,
      positionX: 0,
      positionY: 0,
      positionSaved: false,

      children: [
        {
          id: "a",
          title: "甲",
          hasDocument: false,
          documentId: null,
          headingBlockId: null,
          positionX: 0,
          positionY: 0,
          positionSaved: false,

          children: [],
        },
        {
          id: "b",
          title: "乙",
          hasDocument: false,
          documentId: null,
          headingBlockId: null,
          positionX: 0,
          positionY: 0,
          positionSaved: false,

          children: [],
        },
      ],
    };

    const graph = buildMindMap(root, null, () => undefined);
    const rootNode = graph.nodes.find((item) => item.id === "map:test")!;
    const first = graph.nodes.find((item) => item.id === "a")!;
    const second = graph.nodes.find((item) => item.id === "b")!;
    expect(first.position.x).toBeGreaterThan(rootNode.position.x);
    expect(second.position.x).toBe(first.position.x);
    expect(first.position.y).not.toBe(second.position.y);
  });

  it("arrange ignores saved manual positions", () => {
    const root: MindMapNode = {
      id: "map:test",
      title: "测试",
      hasDocument: false,
      documentId: null,
      headingBlockId: null,
      positionX: 0,
      positionY: 0,
      positionSaved: false,

      children: [
        {
          id: "child",
          title: "子节点",
          hasDocument: false,
          documentId: null,
          headingBlockId: null,
          positionX: 180,
          positionY: 0,
          positionSaved: true,

          children: [],
        },
      ],
    };

    const graph = buildMindMap(root, null, () => undefined, {
      ignoreManual: true,
    });
    expect(
      graph.nodes.find((item) => item.id === "child")?.position.x,
    ).toBeGreaterThan(0);
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
      positionSaved: false,

      children: [
        {
          id: "child",
          title: "子节点",
          hasDocument: false,
          documentId: null,
          headingBlockId: null,
          positionX: 180,
          positionY: 0,
          positionSaved: true,

          children: [],
        },
      ],
    };

    const graph = buildMindMap(root, null, () => undefined);
    const child = graph.nodes.find((item) => item.id === "child")!;
    expect(child.position).toEqual({ x: 180, y: 0 });
  });

  it("keeps a saved node at the origin", () => {
    const root: MindMapNode = {
      id: "map:test",
      title: "测试",
      hasDocument: false,
      documentId: null,
      headingBlockId: null,
      positionX: 0,
      positionY: 0,
      positionSaved: false,
      children: [
        {
          id: "child",
          title: "原点节点",
          hasDocument: false,
          documentId: null,
          headingBlockId: null,
          positionX: 0,
          positionY: 0,
          positionSaved: true,
          children: [],
        },
      ],
    };

    const graph = buildMindMap(root, null, () => undefined);
    const child = graph.nodes.find((item) => item.id === "child")!;
    expect(child.position).toEqual({ x: 0, y: 0 });
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
      positionSaved: true,

      children: [],
    };

    const graph = buildMindMap(root, null, () => undefined);
    expect(graph.nodes[0].position).toEqual({ x: 40, y: 60 });
    expect(graph.nodes[0].draggable).toBe(true);
  });
});
