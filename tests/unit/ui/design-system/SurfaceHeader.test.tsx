import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SurfaceHeader } from "../../../../src/ui/design-system/SurfaceHeader";

afterEach(cleanup);

describe("SurfaceHeader", () => {
  it("renders title, subtitle, actions and close", () => {
    const onClose = vi.fn();
    render(
      <SurfaceHeader
        className="test-header"
        title="知识库"
        subtitle="本机书库"
        actions={<span>3 项</span>}
        onClose={onClose}
        closeLabel="关闭测试"
      />,
    );
    expect(screen.getByText("知识库")).toBeTruthy();
    expect(screen.getByText("本机书库")).toBeTruthy();
    expect(screen.getByText("3 项")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭测试" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
