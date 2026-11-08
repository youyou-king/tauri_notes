import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ShellProps } from "../../../../src/runtime/contracts";
import { MobileRuntimeShell } from "../../../../src/ui/shell/MobileRuntimeShell";

vi.mock("../../../../src/ui/shell/MobileShell", () => ({
  MobileShell: (props: {
    onCreateKnowledgeBase?: () => void;
    onOpenWorkspace?: () => void;
  }) => (
    <button type="button" onClick={() => props.onCreateKnowledgeBase?.()}>
      new
    </button>
  ),
}));

afterEach(cleanup);

describe("MobileRuntimeShell", () => {
  it("forwards empty-state callbacks to MobileShell", () => {
    const onCreateKnowledgeBase = vi.fn();
    const onOpenWorkspace = vi.fn();
    const props = {
      pluginReady: true,
      error: null,
      workspace: null,
      workspaces: [],
      activeMap: null,
      selected: null,
      onCreateKnowledgeBase,
      onOpenWorkspace,
    } as unknown as ShellProps;

    render(<MobileRuntimeShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "new" }));
    expect(onCreateKnowledgeBase).toHaveBeenCalledOnce();
    expect(onOpenWorkspace).not.toHaveBeenCalled();
  });
});