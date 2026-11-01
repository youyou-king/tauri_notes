import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileDocumentPane } from "./MobileDocumentPane";
import type { PanelContextValue } from "../panels/PanelContext";

const panelContext = {} as PanelContextValue;
const swipeHandlers = {
  onPointerDown: vi.fn(),
  onPointerUp: vi.fn(),
  onPointerCancel: vi.fn(),
  onPointerLeave: vi.fn(),
};

afterEach(cleanup);

describe("MobileDocumentPane", () => {
  it("shows read-only content and enters edit mode", () => {
    const onEdit = vi.fn();
    render(
      <MobileDocumentPane
        workspaceRoot="/tmp/demo.note"
        documentId="map/doc"
        editing={false}
        panelContext={panelContext}
        DocumentView={null}
        swipeHandlers={swipeHandlers}
        onSave={vi.fn()}
        onDone={vi.fn()}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("renders the editor and wires save/done", () => {
    function Editor() {
      return <div>Editor</div>;
    }
    const onSave = vi.fn();
    const onDone = vi.fn();
    render(
      <MobileDocumentPane
        workspaceRoot="/tmp/demo.note"
        documentId="map/doc"
        editing
        panelContext={panelContext}
        DocumentView={Editor}
        swipeHandlers={swipeHandlers}
        onSave={onSave}
        onDone={onDone}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Editor")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
  });
});