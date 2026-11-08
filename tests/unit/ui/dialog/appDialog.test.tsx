import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  alertDialog,
  AppDialogHost,
  confirmDialog,
  promptDialog,
  useAppDialogStore,
} from "../../../../src/ui/dialog/appDialog";

beforeEach(() => {
  useAppDialogStore.setState({ pending: [] });
});

afterEach(cleanup);

describe("app dialogs", () => {
  it("resolves prompt text on confirm", async () => {
    const answer = promptDialog({
      title: "新建节点",
      defaultValue: "未命名",
    });
    render(<AppDialogHost />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("未命名");
    fireEvent.change(input, { target: { value: "项目笔记" } });
    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    await expect(answer).resolves.toBe("项目笔记");
  });

  it("returns null when prompt is cancelled", async () => {
    const answer = promptDialog({ title: "新建节点" });
    render(<AppDialogHost />);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await expect(answer).resolves.toBeNull();
  });

  it("dismisses an alert with the shared dialog", async () => {
    const answer = alertDialog({ message: "保存失败" });
    render(<AppDialogHost />);
    expect(screen.getByRole("dialog").textContent).toContain("保存失败");
    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    await expect(answer).resolves.toBeUndefined();
  });

  it("resolves confirm through the same host", async () => {
    const answer = confirmDialog({
      title: "丢弃修改？",
      message: "未保存的修改会丢失。",
      tone: "danger",
    });
    render(<AppDialogHost />);
    expect(screen.getByRole("dialog").textContent).toContain(
      "未保存的修改会丢失。",
    );
    const confirm = screen.getByRole("button", { name: "确定" });
    expect(confirm.className).toContain("danger");
    fireEvent.click(confirm);
    await expect(answer).resolves.toBe(true);
  });
});
