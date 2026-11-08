import { describe, expect, it, vi } from "vitest";
import { createWorkspacePresenter } from "../../../../src/runtime/services/workspacePresenter";
import type { WorkspaceView } from "../../../../src/types";
import { asLibraryPath } from "../../../../src/types";

const view = {
  id: "lib_demo",
  root: asLibraryPath("/tmp/demo.note"),
  title: "Demo",
  maps: [],
} as WorkspaceView;

describe("workspace presenter", () => {
  it("forwards calls to the bound shell handlers", () => {
    const presenter = createWorkspacePresenter();
    const present = vi.fn();
    const reset = vi.fn();
    const activate = vi.fn();
    presenter.bind({
      present,
      resetLayout: reset,
      activatePanel: activate,
    });

    presenter.present(view, true);
    presenter.resetLayout();
    presenter.activatePanel("doc:1");

    expect(present).toHaveBeenCalledWith(view, true);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith("doc:1");
  });

  it("is a no-op before a shell binds", () => {
    const presenter = createWorkspacePresenter();
    expect(() => {
      presenter.present(view, false);
      presenter.resetLayout();
      presenter.activatePanel("doc:1");
    }).not.toThrow();
  });
});