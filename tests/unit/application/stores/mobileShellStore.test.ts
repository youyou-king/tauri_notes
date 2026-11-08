import { beforeEach, describe, expect, it } from "vitest";
import { useMobileShellStore } from "../../../../src/application/stores/mobileShellStore";
import { resolveDropPlacement } from "../../../../src/application/stores/mobileLayout";

const initial = {
  views: [
    { kind: "map" as const, documentId: null },
    null,
  ] as [
    { kind: "map"; documentId: null },
    null,
  ],
  focused: 0 as const,
  ratios: { column: 0.5, row: 0.5 },
  axis: "column" as const,
};

describe("mobile shell store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMobileShellStore.setState({
      libraryId: null,
      ...initial,
      editing: false,
      history: [],
    });
  });

  it("restores the focused view for the same library id", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().openDocument("doc_1");
    useMobileShellStore.getState().dropView("outline", "below");

    useMobileShellStore.setState({
      libraryId: null,
      ...initial,
      history: [],
    });
    useMobileShellStore.getState().hydrate("demo");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 1,
      views: [
        { kind: "document", documentId: "doc_1" },
        { kind: "outline", documentId: null },
      ],
    });
  });

  it("resets navigation when the library identity changes", () => {
    useMobileShellStore.getState().hydrate("one");
    useMobileShellStore.getState().openDocument("doc_1");
    useMobileShellStore.getState().hydrate("two");
    expect(useMobileShellStore.getState()).toMatchObject({
      libraryId: "two",
      focused: 0,
      views: [{ kind: "map", documentId: null }, null],
    });
  });

  it("keeps navigation when the same library id is hydrated again", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().openDocument("doc_1");
    useMobileShellStore.getState().hydrate("demo");
    expect(useMobileShellStore.getState()).toMatchObject({
      libraryId: "demo",
      focused: 0,
      views: [{ kind: "document", documentId: "doc_1" }, null],
    });
  });

  it("opens a second singleton view in a split pane", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("outline", "below");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 1,
      views: [
        { kind: "map", documentId: null },
        { kind: "outline", documentId: null },
      ],
    });
  });

  it("does not duplicate a view kind in two panes", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("map", "below");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 0,
      views: [{ kind: "map", documentId: null }, null],
    });
  });

  it("restores split ratios after a store reload", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("outline", "below");
    useMobileShellStore.getState().setSplitRatio("column", 0.64);
    useMobileShellStore.getState().setSplitRatio("row", 0.58);

    useMobileShellStore.setState({
      libraryId: null,
      ...initial,
      history: [],
    });
    useMobileShellStore.getState().hydrate("demo");
    expect(useMobileShellStore.getState().ratios).toEqual({
      column: 0.64,
      row: 0.58,
    });
  });

  it("drops a view on the left with a row split", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("outline", "left");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 0,
      axis: "row",
      views: [
        { kind: "outline", documentId: null },
        { kind: "map", documentId: null },
      ],
    });
  });

  it("drops a view in the center by replacing the focused pane", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("outline", "center");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 0,
      views: [{ kind: "outline", documentId: null }, null],
    });
  });

  it("moves an existing view to the opposite dock edge", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("outline", "below");
    useMobileShellStore.getState().dropView("outline", "left");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 0,
      axis: "row",
      views: [
        { kind: "outline", documentId: null },
        { kind: "map", documentId: null },
      ],
    });
  });

  it("opens a known document when no document pane exists", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().selectView("document", "doc-1");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 0,
      views: [{ kind: "document", documentId: "doc-1" }, null],
    });
  });

  it("drops a known document beside the current view", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("document", "right", "doc-1");
    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 1,
      axis: "row",
      views: [
        { kind: "map", documentId: null },
        { kind: "document", documentId: "doc-1" },
      ],
    });
  });

  it("clamps each split axis independently", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("outline", "below");
    useMobileShellStore.getState().setSplitRatio("column", 0.1);
    expect(useMobileShellStore.getState().ratios.column).toBe(0.25);
    expect(useMobileShellStore.getState().ratios.row).toBe(0.5);
    useMobileShellStore.getState().setSplitRatio("row", 0.9);
    expect(useMobileShellStore.getState().ratios.row).toBe(0.75);
    useMobileShellStore.getState().setSplitRatio("column", 0.62);
    expect(useMobileShellStore.getState().ratios.column).toBe(0.62);
  });

  it("keeps the ratio when the split closes", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().dropView("outline", "below");
    useMobileShellStore.getState().setSplitRatio("column", 0.7);
    useMobileShellStore.getState().closeSplit();
    expect(useMobileShellStore.getState().ratios.column).toBe(0.7);
  });

  it("closes the split before popping history", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().selectView("outline");
    useMobileShellStore.getState().openDocument("doc_1");
    useMobileShellStore.getState().dropView("outline", "below");
    expect(useMobileShellStore.getState().back()).toBe(true);
    expect(useMobileShellStore.getState().views[1]).toBeNull();
    expect(useMobileShellStore.getState().views[0]).toMatchObject({
      kind: "document",
      documentId: "doc_1",
    });
  });

  it("returns to the previous view", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().selectView("outline");
    useMobileShellStore.getState().openDocument("doc_1");
    expect(useMobileShellStore.getState().back()).toBe(true);
    expect(useMobileShellStore.getState().views[0]).toMatchObject({
      kind: "outline",
      documentId: null,
    });
    expect(useMobileShellStore.getState().back()).toBe(true);
    expect(useMobileShellStore.getState().views[0]).toMatchObject({
      kind: "map",
      documentId: null,
    });
    expect(useMobileShellStore.getState().back()).toBe(false);
  });

  it("ignores legacy mobile shell storage versions", () => {
    window.localStorage.setItem(
      "tauri-notes.mobile-shell",
      JSON.stringify({
        version: 5,
        libraryId: "demo",
        views: [{ kind: "outline", documentId: null }, null],
        focused: 0,
        ratio: 0.7,
      }),
    );

    useMobileShellStore.getState().hydrate("demo");

    expect(useMobileShellStore.getState()).toMatchObject({
      focused: 0,
      views: [{ kind: "map", documentId: null }, null],
      ratios: { column: 0.5, row: 0.5 },
    });
  });

  it("resets when no library is active", () => {
    useMobileShellStore.getState().hydrate("demo");
    useMobileShellStore.getState().openDocument("doc_1");
    useMobileShellStore.getState().hydrate(null);
    expect(useMobileShellStore.getState()).toMatchObject({
      libraryId: null,
      focused: 0,
      views: [{ kind: "map", documentId: null }, null],
    });
  });
});

describe("dock drop placement", () => {
  const viewport = { width: 1000, height: 800 };

  it("maps edges and center to dock zones", () => {
    expect(resolveDropPlacement({ x: 100, y: 400 }, viewport)).toBe("left");
    expect(resolveDropPlacement({ x: 900, y: 400 }, viewport)).toBe("right");
    expect(resolveDropPlacement({ x: 500, y: 100 }, viewport)).toBe("above");
    expect(resolveDropPlacement({ x: 500, y: 700 }, viewport)).toBe("below");
    expect(resolveDropPlacement({ x: 500, y: 400 }, viewport)).toBe("center");
  });
});