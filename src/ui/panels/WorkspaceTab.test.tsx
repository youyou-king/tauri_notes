import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IDockviewPanelHeaderProps } from "dockview-react";
import { usePanelStore } from "../../application/stores/panelStore";
import { confirmDialog } from "../dialog/confirmDialog";
import { WorkspaceTab } from "./WorkspaceTab";

vi.mock("../dialog/confirmDialog", () => ({
  confirmDialog: vi.fn(),
}));

function props(id: string, close: () => void) {
  return {
    api: {
      id,
      title: "Document",
      component: "blockdoc",
      close,
      onDidTitleChange: () => ({ dispose: () => {} }),
    },
    containerApi: {},
    params: {},
    tabLocation: "header",
  } as unknown as IDockviewPanelHeaderProps;
}

describe("WorkspaceTab", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(confirmDialog).mockReset();
    usePanelStore.setState({
      dirtyPanels: {},
      panelStatus: {},
    });
  });

  it("closes a clean panel without confirmation", () => {
    const close = vi.fn();
    render(<WorkspaceTab {...props("doc:clean", close)} />);
    screen.getByTitle("关闭面板").click();
    expect(close).toHaveBeenCalledOnce();
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it("confirms before closing a dirty panel", async () => {
    const close = vi.fn();
    usePanelStore.setState({
      dirtyPanels: { "doc:dirty": true },
      panelStatus: { "doc:dirty": "dirty" },
    });
    vi.mocked(confirmDialog).mockResolvedValue(true);

    render(<WorkspaceTab {...props("doc:dirty", close)} />);
    screen.getByTitle("关闭面板").click();

    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(confirmDialog).toHaveBeenCalledOnce();
  });

  it("keeps a dirty panel open when the user cancels", async () => {
    const close = vi.fn();
    usePanelStore.setState({
      dirtyPanels: { "doc:dirty": true },
      panelStatus: { "doc:dirty": "dirty" },
    });
    vi.mocked(confirmDialog).mockResolvedValue(false);

    render(<WorkspaceTab {...props("doc:dirty", close)} />);
    screen.getByTitle("关闭面板").click();

    await waitFor(() => expect(confirmDialog).toHaveBeenCalledOnce());
    expect(close).not.toHaveBeenCalled();
  });
});
