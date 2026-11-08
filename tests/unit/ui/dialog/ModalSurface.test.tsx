import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModalSurface } from "../../../../src/ui/dialog/ModalSurface";

afterEach(cleanup);

describe("ModalSurface", () => {
  it("focuses the autofocus element and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ModalSurface onClose={onClose} ariaLabel="测试">
        <button type="button" data-autofocus>
          确定
        </button>
      </ModalSurface>,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "确定" }),
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on backdrop but not on panel interaction", () => {
    const onClose = vi.fn();
    render(
      <ModalSurface onClose={onClose} ariaLabel="测试">
        <button type="button">确定</button>
      </ModalSurface>,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("handles Escape only on the top modal", () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    render(
      <ModalSurface onClose={closeParent} ariaLabel="父级">
        <button type="button">父级按钮</button>
        <ModalSurface onClose={closeChild} ariaLabel="子级">
          <button type="button">子级按钮</button>
        </ModalSurface>
      </ModalSurface>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });
});
