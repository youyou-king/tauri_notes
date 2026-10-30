import { beforeEach, describe, expect, it } from "vitest";
import {
  crossPanelBus,
  PANEL_DRAG_MIME,
  type PanelEvent,
} from "./panelEvents";

function fakeDataTransfer() {
  const data = new Map<string, string>();
  return {
    effectAllowed: "none",
    setData(type: string, value: string) {
      data.set(type, value);
    },
    getData(type: string) {
      return data.get(type) ?? "";
    },
  } as unknown as DataTransfer;
}

beforeEach(() => {
  crossPanelBus.endDrag();
});

describe("crossPanelBus", () => {
  it("broadcasts typed drag events and keeps active payloads", () => {
    const events: PanelEvent[] = [];
    const unsubscribe = crossPanelBus.subscribe((event) => events.push(event));
    crossPanelBus.startDrag(
      { kind: "document", root: "/notes", documentId: "map-1/doc-1" },
      "outline",
    );
    expect(crossPanelBus.getActive()).toMatchObject({
      kind: "document",
      documentId: "map-1/doc-1",
    });
    expect(events[0]?.type).toBe("drag-start");
    expect(
      events[0]?.type === "drag-start" ? events[0].sourcePanel : undefined,
    ).toBe("outline");
    unsubscribe();
    crossPanelBus.endDrag();
  });

  it("writes and reads the panel MIME payload", () => {
    const transfer = fakeDataTransfer();
    const payload = {
      kind: "reference" as const,
      documentId: "map-1/doc-1",
      blockIds: ["block-a", "block-b"],
    };
    crossPanelBus.write(transfer, payload);
    expect(transfer.getData(PANEL_DRAG_MIME)).toContain("block-a");
    expect(crossPanelBus.read(transfer)).toEqual(payload);
  });

  it("falls back to the in-memory drag for synthetic drops", () => {
    const payload = { kind: "text" as const, text: "引用内容" };
    crossPanelBus.startDrag(payload, "document");
    expect(crossPanelBus.read(fakeDataTransfer())).toEqual(payload);
    crossPanelBus.endDrag();
    expect(crossPanelBus.getActive()).toBeNull();
  });
});
