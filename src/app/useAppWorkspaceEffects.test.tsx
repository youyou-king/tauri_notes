import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { readSession, SESSION_KEY } from "../application/sessionService";
import type { WorkspaceView } from "../types";
import { useSessionPersistence } from "./useAppWorkspaceEffects";

beforeEach(() => {
  window.localStorage.clear();
});

const workspace = { root: "C:/notes" } as WorkspaceView;

describe("useSessionPersistence", () => {
  it("writes workspaces and selection after session is ready", () => {
    const sessionReady = { current: true };
    renderHook(() =>
      useSessionPersistence({
        sessionReady,
        workspaces: [workspace],
        workspaceRoot: workspace.root,
        activeMapId: "map-1",
        selectedNodeId: "node-1",
        activePanelId: "blockdoc_1",
      }),
    );
    expect(window.localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(readSession()).toMatchObject({
      roots: [workspace.root],
      activeRoot: workspace.root,
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
        workspaceRoot: workspace.root,
        activeMapId: null,
        selectedNodeId: null,
        activePanelId: null,
      }),
    );
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
