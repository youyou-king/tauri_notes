import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileDocumentPane } from "../../../../src/ui/mobile/MobileDocumentPane";
import type { PanelContextValue } from "../../../../src/ui/panels/PanelContext";

const panelContext = {} as PanelContextValue;
const swipeHandlers = {
  onPointerDown: vi.fn(),
  onPointerUp: vi.fn(),
  onPointerCancel: vi.fn(),
  onPointerLeave: vi.fn(),
};

afterEach(cleanup);

describe("MobileDocumentPane", () => {
  it("keeps the editor unmounted in read mode", () => {
    function Editor() {
      return <div>Editor</div>;
    }
    const { container } = render(
      <MobileDocumentPane
        workspaceRoot="/tmp/demo.note"
        libraryId="lib_demo"
        documentId="map/doc"
        editing={false}
        panelContext={panelContext}
        DocumentView={Editor}
        swipeHandlers={swipeHandlers}
      />,
    );
    expect(screen.queryByText("Editor")).toBeNull();
    expect(container.querySelector(".mobile-document-shell.is-editing")).toBeNull();
  });

  it("renders the editor in editing mode", () => {
    function Editor() {
      return <div>Editor</div>;
    }
    const { container } = render(
      <MobileDocumentPane
        workspaceRoot="/tmp/demo.note"
        libraryId="lib_demo"
        documentId="map/doc"
        editing
        panelContext={panelContext}
        DocumentView={Editor}
        swipeHandlers={swipeHandlers}
      />,
    );
    expect(screen.getByText("Editor")).toBeTruthy();
    expect(container.querySelector(".mobile-document-shell.is-editing")).toBeTruthy();
  });
});