import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { readSession, SESSION_KEY } from "../../../src/application/sessionService";
import type { WorkspaceView } from "../../../src/types";
import { asLibraryPath } from "../../../src/types";
import { useSessionPersistence } from "../../../src/app/useAppWorkspaceEffects";

beforeEach(() => {
  window.localStorage.clear();
});

const workspace = {
  id: "lib_notes",
  root: asLibraryPath("C:/notes"),
  title: "Notes",
  maps: [],
} as WorkspaceView;

describe("useSessionPersistence", () => {
  it("writes workspaces and selection after session is ready", () => {
    const sessionReady = { current: true };
    renderHook(() =>
      useSessionPersistence({
        sessionReady,
        workspaces: [workspace],
        missingLibraries: [],
        activeId: workspace.id,
        activeMapId: "map-1",
        selectedNodeId: "node-1",
        activePanelId: "blockdoc_1",
      }),
    );
    expect(window.localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(readSession()).toMatchObject({
      version: 4,
      libraries: [{ id: workspace.id, path: workspace.root }],
      activeId: workspace.id,
      missing: [],
      activeMapId: "map-1",
      selectedNodeId: "node-1",
      activePanelId: "blockdoc_1",
    });
  });

  it("does not write before restore completes", () => {
    const sessionReady = { current: false };
    renderHook(() =>
      useSessionPersistence({
        sessionReady,
        workspaces: [workspace],
        missingLibraries: [],
        activeId: workspace.id,
        activeMapId: null,
        selectedNodeId: null,
        activePanelId: null,
      }),
    );
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
