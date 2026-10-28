import { describe, expect, it } from "vitest";
import "./navCommands";
import { getCommand } from "../ui/commands/registry";

describe("navigation commands", () => {
  it("registers knowledge and view commands", () => {
    expect(getCommand("knowledge.create")?.label).toContain("新建");
    expect(getCommand("knowledge.open")?.label).toContain("打开");
    expect(getCommand("knowledge.backup")?.label).toBe("保存");
    expect(getCommand("view.outline")?.label).toBe("大纲");
    expect(getCommand("view.console")?.label).toBe("控制台");
    expect(getCommand("view.reset-layout")?.label).toBe("重置布局");
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
