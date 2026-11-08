import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileManagedLibraries } from "../../../../src/ui/mobile/MobileManagedLibraries";

const library = {
  id: "demo",
  title: "Demo",
  path: "/app/libraries/demo.note",
  kind: "note" as const,
  lastOpenedAt: 0,
};

describe("MobileManagedLibraries", () => {
  afterEach(cleanup);
  it("opens a library and reports export", () => {
    const onOpen = vi.fn();
    const onExport = vi.fn();
    const onShare = vi.fn();
    render(
      <MobileManagedLibraries
        libraries={[library]}
        workspaceId="demo"
        onOpen={onOpen}
        onImport={vi.fn()}
        onShare={onShare}
        onExport={onExport}
      />,
    );
    expect(screen.getByText("当前")).toBeTruthy();
    fireEvent.click(screen.getByText("Demo"));
    expect(onOpen).toHaveBeenCalledWith("/app/libraries/demo.note");
    fireEvent.click(screen.getByLabelText("导出 Demo"));
    expect(onExport).toHaveBeenCalledWith(library);
  });

  it("imports from the empty state and section header", () => {
    const onImport = vi.fn();
    render(
      <MobileManagedLibraries
        libraries={[]}
        workspaceId={null}
        onOpen={vi.fn()}
        onImport={onImport}
        onShare={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByText("还没有导入或新建书库。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "导入" }));
    expect(onImport).toHaveBeenCalledOnce();
  });
});