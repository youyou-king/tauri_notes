import { beforeEach, describe, expect, it } from "vitest";
import { useMobileShellStore } from "./mobileShellStore";

describe("mobile shell store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMobileShellStore.setState({
      workspaceRoot: null,
      tab: "map",
      documentId: null,
      editing: false,
      history: [],
    });
  });

  it("restores tab and document for the same workspace", () => {
    useMobileShellStore.getState().hydrate("/notes/demo.note");
    useMobileShellStore.getState().openDocument("map_1/doc_1");
    useMobileShellStore.getState().setTab("library");

    useMobileShellStore.setState({
      workspaceRoot: null,
      tab: "map",
      documentId: null,
      history: [],
    });
    useMobileShellStore.getState().hydrate("/notes/demo.note");
    expect(useMobileShellStore.getState()).toMatchObject({
      tab: "library",
      documentId: "map_1/doc_1",
    });
  });

  it("resets when switching to a different workspace", () => {
    useMobileShellStore.getState().hydrate("/notes/one.note");
    useMobileShellStore.getState().openDocument("map_1/doc_1");
    useMobileShellStore.getState().hydrate("/notes/two.note");
    expect(useMobileShellStore.getState()).toMatchObject({
      workspaceRoot: "/notes/two.note",
      tab: "map",
      documentId: null,
    });
  });

  it("returns to the previous tab or document", () => {
    useMobileShellStore.getState().hydrate("/notes/demo.note");
    useMobileShellStore.getState().setTab("library");
    useMobileShellStore.getState().openDocument("map_1/doc_1");
    expect(useMobileShellStore.getState().back()).toBe(true);
    expect(useMobileShellStore.getState()).toMatchObject({
      tab: "library",
      documentId: null,
    });
    expect(useMobileShellStore.getState().back()).toBe(true);
    expect(useMobileShellStore.getState().tab).toBe("map");
    expect(useMobileShellStore.getState().back()).toBe(false);
  });
});