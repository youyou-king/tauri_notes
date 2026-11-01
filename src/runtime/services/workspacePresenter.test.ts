import { describe, expect, it, vi } from "vitest";
import { createWorkspacePresenter } from "./workspacePresenter";
import type { WorkspaceView } from "../../types";

const view = {
  root: "/tmp/demo.note",
  title: "Demo",
  maps: [],
} as WorkspaceView;

describe("workspace presenter", () => {
  it("forwards calls to the bound shell handlers", () => {
    const presenter = createWorkspacePresenter();
    const present = vi.fn();
    const reset = vi.fn();
    const close = vi.fn();
    const activate = vi.fn();
    presenter.bind({
      present,
      resetLayout: reset,
      closeWorkspace: close,
      activatePanel: activate,
    });

    presenter.present(view, true);
    presenter.resetLayout();
    presenter.closeWorkspace("/tmp/demo.note", view);
    presenter.activatePanel("doc:1");

    expect(present).toHaveBeenCalledWith(view, true);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith("/tmp/demo.note", view);
    expect(activate).toHaveBeenCalledWith("doc:1");
  });

  it("is a no-op before a shell binds", () => {
    const presenter = createWorkspacePresenter();
    expect(() => {
      presenter.present(view, false);
      presenter.resetLayout();
      presenter.closeWorkspace("/tmp/demo.note");
      presenter.activatePanel("doc:1");
    }).not.toThrow();
  });
});