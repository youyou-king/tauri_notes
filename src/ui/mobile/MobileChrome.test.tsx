import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";

afterEach(cleanup);

describe("mobile chrome", () => {
  it("switches tabs and disables document without a selection", () => {
    const onSwitchTab = vi.fn();
    render(
      <MobileTabBar
        tab="map"
        documentId={null}
        onSwitchTab={onSwitchTab}
        onSettings={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    expect(onSwitchTab).toHaveBeenCalledWith("library");
    expect(
      (screen.getByRole("button", { name: "文档" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows the current title and forwards header actions", () => {
    const onBack = vi.fn();
    const onSearch = vi.fn();
    render(
      <MobileHeader
        tab="library"
        mapTitle="Map"
        workspaceTitle="Workspace"
        canGoBack
        onBack={onBack}
        onSearch={onSearch}
        onHelp={vi.fn()}
        onBoard={vi.fn()}
      />,
    );
    expect(screen.getByText("目录")).toBeTruthy();
    expect(screen.getByText("Workspace")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledOnce();
  });
});