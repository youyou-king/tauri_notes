import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import {
  EMPTY_EDITOR_SNAPSHOT,
  type EditorSnapshot,
} from "../../../../../src/application/state/editorSnapshot";

let current: EditorSnapshot = EMPTY_EDITOR_SNAPSHOT;
const listeners = new Map<string, Set<() => void>>();

vi.mock("../../../../../src/application/state/editorSnapshot", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../../../src/application/state/editorSnapshot")
    >();
  return {
    ...actual,
    editorSnapshot: () => current,
  };
});

import { useEditorField } from "../../../../../src/plugins/import/ui/useEditorField";

function fakeEditor(): Editor {
  return {
    isDestroyed: false,
    on: (event: string, listener: () => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    },
    off: (event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    },
  } as unknown as Editor;
}

function emit(event: string) {
  for (const listener of listeners.get(event) ?? []) {
    listener();
  }
}

const block = {
  pos: 1,
  type: "paragraph",
  span: 12,
  heightMode: "auto" as const,
  heightPx: 0,
  zoom: 100,
};

beforeEach(() => {
  current = EMPTY_EDITOR_SNAPSHOT;
  listeners.clear();
});

describe("useEditorField", () => {
  it("updates when the selected field changes", () => {
    const editor = fakeEditor();
    const { result } = renderHook(() =>
      useEditorField(
        editor,
        null,
        (snapshot) => snapshot.selectedBlock,
        (left, right) => left?.pos === right?.pos,
      ),
    );
    expect(result.current).toBeNull();
    current = { ...EMPTY_EDITOR_SNAPSHOT, selectedBlock: block };
    act(() => emit("selectionUpdate"));
    expect(result.current).toEqual(block);
  });

  it("keeps the previous value when the field is equal", () => {
    const editor = fakeEditor();
    current = { ...EMPTY_EDITOR_SNAPSHOT, selectedBlock: block };
    const { result } = renderHook(() =>
      useEditorField(
        editor,
        null,
        (snapshot) => snapshot.selectedBlock,
        (left, right) => left?.pos === right?.pos,
      ),
    );
    const first = result.current;
    current = {
      ...EMPTY_EDITOR_SNAPSHOT,
      selectedBlock: { ...block },
    };
    act(() => emit("transaction"));
    expect(result.current).toBe(first);
  });
});
