import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button, IconButton } from "../../../../src/ui/design-system/Button";
import {
  Field,
  Select,
  TextInput,
} from "../../../../src/ui/design-system/Field";
import { StateView } from "../../../../src/ui/design-system/StateView";
import { Popover } from "../../../../src/ui/design-system/Popover";
import { Icon } from "../../../../src/ui/design-system/Icon";
import { PanelIcon } from "../../../../src/ui/design-system/PanelIcon";

afterEach(cleanup);

describe("design system primitives", () => {
  it("renders a safe button and forwards its variant", () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        保存
      </Button>,
    );
    const button = screen.getByRole("button", { name: "保存" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("ui-button-primary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("provides labeled fields and selects", () => {
    render(
      <Field label="名称">
        <TextInput defaultValue="未命名" />
      </Field>,
    );
    expect((screen.getByLabelText("名称") as HTMLInputElement).value).toBe(
      "未命名",
    );
  });

  it("renders icon buttons with an accessible name", () => {
    render(<IconButton label="关闭">×</IconButton>);
    expect(screen.getByRole("button", { name: "关闭" })).toBeTruthy();
  });

  it("renders options through the shared select", () => {
    render(
      <Field label="模式">
        <Select defaultValue="dark">
          <option value="dark">深色</option>
          <option value="light">浅色</option>
        </Select>
      </Field>,
    );
    expect((screen.getByLabelText("模式") as HTMLSelectElement).value).toBe(
      "dark",
    );
  });

  it("renders a shared error state", () => {
    render(<StateView tone="error" detail="保存失败" />);
    expect(screen.getByRole("alert").textContent).toContain("保存失败");
  });

  it("renders a dismissable popover", () => {
    const onClose = vi.fn();
    render(
      <Popover
        open
        anchor={{ kind: "point", x: 20, y: 30 }}
        onClose={onClose}
        ariaLabel="测试菜单"
      >
        <button type="button">菜单项</button>
      </Popover>,
    );
    expect(screen.getByRole("menu", { name: "测试菜单" })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders decorative icons consistently", () => {
    const { container } = render(<Icon name="close" />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.querySelector("path")).toBeTruthy();
  });

  it("maps known panel icons and preserves unknown labels", () => {
    const { container, rerender } = render(<PanelIcon icon="🗂" />);
    expect(container.querySelector("svg")).toBeTruthy();
    rerender(<PanelIcon icon="custom" />);
    expect(container.textContent).toBe("custom");
  });
});
