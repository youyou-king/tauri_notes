import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileDock } from "../../../../src/ui/mobile/MobileDock";
import { MobileNavDrawer } from "../../../../src/ui/mobile/MobileNavDrawer";
import { MobileTopBar } from "../../../../src/ui/mobile/MobileTopBar";

afterEach(cleanup);

describe("mobile chrome", () => {
  it("switches views and disables document without a selection", () => {
    const onSelect = vi.fn();
    render(
      <MobileDock
        view="map"
        hasDocument={false}
        presentKinds={["map"]}
        onSelect={onSelect}
        onDragMove={vi.fn()}
        onDrop={vi.fn()}
        onDragCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "大纲" }));
    expect(onSelect).toHaveBeenCalledWith("outline");
    expect(
      (screen.getByRole("button", { name: "文档" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("drops a dock tab at the pointer position", () => {
    const onDrop = vi.fn();
    const onDragMove = vi.fn();
    render(
      <MobileDock
        view="map"
        hasDocument
        presentKinds={["map"]}
        onSelect={vi.fn()}
        onDragMove={onDragMove}
        onDrop={onDrop}
        onDragCancel={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: "大纲" });
    fireEvent.mouseDown(button, { clientX: 40, clientY: 100, button: 0 });
    fireEvent.mouseMove(button, { clientX: 40, clientY: 50 });
    fireEvent.mouseUp(button, { clientX: 40, clientY: 50 });
    expect(onDragMove).toHaveBeenCalledWith("outline", {
      x: 40,
      y: 50,
    });
    expect(onDrop).toHaveBeenCalledWith("outline", {
      x: 40,
      y: 50,
    });
  });

  it("shows the current title and forwards chrome actions", () => {
    const onBack = vi.fn();
    const onMenu = vi.fn();
    render(
      <MobileTopBar
        title="目录"
        subtitle="Workspace"
        canGoBack
        onBack={onBack}
        onMenu={onMenu}
      />,
    );
    expect(screen.getByText("目录")).toBeTruthy();
    expect(screen.getByText("Workspace")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(onMenu).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "更多" })).toBeNull();
  });

  it("keeps the back action separate from the drawer action", () => {
    const onMenu = vi.fn();
    render(
      <MobileTopBar
        title="文档"
        canGoBack
        onBack={vi.fn()}
        onMenu={onMenu}
      />,
    );
    expect(screen.getByRole("button", { name: "打开导航" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "返回" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    expect(onMenu).toHaveBeenCalledOnce();
  });

  it("uses the menu action when there is no back entry", () => {
    render(
      <MobileTopBar
        title="导图"
        canGoBack={false}
        onBack={vi.fn()}
        onMenu={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "打开导航" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "返回" })).toBeNull();
  });

  it("keeps the drawer to the desktop global navigation", () => {
    const onKnowledgeCommand = vi.fn();
    const onManageLibraries = vi.fn();
    render(
      <MobileNavDrawer
        open
        workspaceTitle="演示知识库"
        knowledgeItems={[
          {
            id: "knowledge.create",
            label: "新建知识库",
            commandId: "knowledge.create",
          },
        ]}
        onKnowledgeCommand={onKnowledgeCommand}
        onManageLibraries={onManageLibraries}
        onClose={vi.fn()}
        onHelp={vi.fn()}
        onSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "知识库" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "视图" })).toBeNull();
    expect(screen.queryByRole("button", { name: "外观" })).toBeNull();
    expect(screen.getByRole("button", { name: "设置" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "帮助" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "新建知识库" }));
    expect(onKnowledgeCommand).toHaveBeenCalledWith("knowledge.create");
    fireEvent.click(screen.getByRole("button", { name: "管理知识库" }));
    expect(onManageLibraries).toHaveBeenCalledOnce();
  });
});