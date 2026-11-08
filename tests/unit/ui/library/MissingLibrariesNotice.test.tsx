import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MissingLibrariesNotice } from "../../../../src/ui/library/MissingLibrariesNotice";

describe("MissingLibrariesNotice", () => {
  afterEach(cleanup);

  it("lets the user relocate or forget a missing library", () => {
    const onRelocate = vi.fn();
    const onForget = vi.fn();
    const item = {
      id: "lib_missing" as const,
      path: "/missing/demo.note",
      reason: "not found",
    };
    render(
      <MissingLibrariesNotice
        items={[item]}
        onRelocate={onRelocate}
        onForget={onForget}
      />,
    );
    expect(screen.getByText("有 1 个书库无法打开")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新定位" }));
    expect(onRelocate).toHaveBeenCalledWith(item);
    fireEvent.click(screen.getByRole("button", { name: "移除" }));
    expect(onForget).toHaveBeenCalledWith(item);
  });

  it("renders nothing without missing entries", () => {
    const { container } = render(
      <MissingLibrariesNotice
        items={[]}
        onRelocate={vi.fn()}
        onForget={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});