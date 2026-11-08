import { describe, expect, it } from "vitest";
import "../../../src/app/navCommands";
import { getCommand } from "../../../src/kernel/command";

describe("navigation commands", () => {
  it("registers knowledge and view commands", () => {
    expect(getCommand("knowledge.create")?.label).toBe("新建知识库");
    expect(getCommand("knowledge.open")?.label).toBe("打开知识库");
    expect(getCommand("knowledge.backup")?.label).toBe("备份知识库");
    expect(getCommand("view.outline")?.label).toBe("大纲");
    expect(getCommand("view.console")?.label).toBe("控制台");
    expect(getCommand("view.clear-layout")?.label).toBe("清空布局");
  });

  it("disables backup without a workspace", () => {
    const backup = getCommand("knowledge.backup")!;
    expect(
      backup.enabled?.({
        busy: false,
        hasWorkspace: false,
      }),
    ).toBe(false);
    expect(
      backup.enabled?.({
        busy: false,
        hasWorkspace: true,
      }),
    ).toBe(true);
  });
});
