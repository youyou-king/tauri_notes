import { afterEach, describe, expect, it } from "vitest";
import {
  createMobileAlert,
  createMobileConfirm,
  createMobilePrompt,
} from "./mobileDialogs";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("mobile dialogs", () => {
  it("resolves prompt text on confirm", async () => {
    const answer = createMobilePrompt({ title: "新建知识库", defaultValue: "未命名" });
    const input = document.querySelector<HTMLInputElement>(".mobile-dialog-input");
    expect(input?.value).toBe("未命名");
    if (input) {
      input.value = "项目笔记";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    }
    await expect(answer).resolves.toBe("项目笔记");
    expect(document.querySelector(".mobile-dialog")).toBeNull();
  });

  it("returns null when prompt is cancelled", async () => {
    const answer = createMobilePrompt({ title: "新建知识库" });
    const cancel = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "取消",
    );
    cancel?.click();
    await expect(answer).resolves.toBeNull();
  });

  it("resolves confirm and dismisses alert", async () => {
    const answer = createMobileConfirm({
      title: "丢弃修改？",
      message: "未保存的修改会丢失。",
      tone: "danger",
    });
    const confirm = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "确定",
    );
    expect(confirm?.className).toBe("danger");
    confirm?.click();
    await expect(answer).resolves.toBe(true);

    createMobileAlert("保存失败");
    expect(document.querySelector(".mobile-dialog-message")?.textContent).toBe(
      "保存失败",
    );
    const ok = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "确定",
    );
    ok?.click();
    expect(document.querySelector(".mobile-dialog")).toBeNull();
  });
});