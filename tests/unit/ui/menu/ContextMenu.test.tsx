import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ContextMenu } from "../../../../src/ui/menu/ContextMenu";

afterEach(cleanup);

function renderMenu(onClose = vi.fn(), onSelect = vi.fn()) {
  render(
    <ContextMenu
      position={{ x: 200, y: 300 }}
      onClose={onClose}
      items={[
        { id: "open", label: "打开文档", onSelect },
        {
          id: "delete",
          label: "删除节点…",
          danger: true,
          separatorBefore: true,
          onSelect,
        },
      ]}
    />,
  );
  return { onClose, onSelect };
}

describe("ContextMenu", () => {
  it("renders in the body and clamps its position", () => {
    renderMenu();
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu.style.left).toBe("200px");
    expect(menu.style.top).toBe("300px");
    expect(menu.querySelectorAll("button")).toHaveLength(2);
    expect(menu.querySelector(".context-menu-separator")).toBeTruthy();
  });

  it("selects an item and closes first", () => {
    const { onClose, onSelect } = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "打开文档" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape and outside pointer down", () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});