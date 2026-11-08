import { afterEach, describe, expect, it, vi } from "vitest";
import { crossPanelBus } from "../../../../src/kernel/event";
import {
  acceptsOutlineDocumentDrop,
  createOutlineDragDrop,
  readNoteDocumentDrop,
} from "../../../../src/ui/outline/outlineDragDrop";

function transfer(values: Record<string, string> = {}): Pick<
  DataTransfer,
  "getData"
> {
  return {
    getData: (type: string) => values[type] ?? "",
  };
}

afterEach(() => {
  crossPanelBus.endDrag();
});

describe("outline drag adapter", () => {
  it("accepts both note-document and panel drag types", () => {
    expect(
      acceptsOutlineDocumentDrop(["application/x-note-document"]),
    ).toBe(true);
    expect(
      acceptsOutlineDocumentDrop(["application/x-tauri-notes-panel"]),
    ).toBe(true);
    expect(acceptsOutlineDocumentDrop(["text/plain"])).toBe(false);
  });

  it("reads a note-document payload", () => {
    expect(
      readNoteDocumentDrop(
        transfer({
          "application/x-note-document": JSON.stringify({
            root: "/library.note",
            documentId: "doc-1",
          }),
        }),
      ),
    ).toEqual({ root: "/library.note", documentId: "doc-1" });
    expect(
      readNoteDocumentDrop(
        transfer({
          "application/x-note-document": "{bad json",
        }),
      ),
    ).toBeNull();
  });

  it("uses the cross-panel drag payload as a fallback", () => {
    crossPanelBus.startDrag(
      {
        kind: "document",
        root: "/library.note",
        documentId: "doc-1",
      },
      "outline",
    );
    const onDropDocument = vi.fn();
    const adapter = createOutlineDragDrop("node-1", onDropDocument);
    adapter.onDrop({
      dataTransfer: transfer(),
    } as unknown as Parameters<typeof adapter.onDrop>[0]);
    expect(onDropDocument).toHaveBeenCalledWith(
      "node-1",
      "/library.note",
      "doc-1",
    );
  });
});