import { describe, expect, it } from "vitest";
import { validateContribution } from "./contributionSchema";

describe("contribution schema", () => {
  it("accepts valid commands and panels", () => {
    expect(
      validateContribution("commands", { id: "x.run", label: "Run" }),
    ).toEqual([]);
    expect(
      validateContribution("panels", {
        id: "x.panel",
        title: "Panel",
        renderer: "x.panel",
      }),
    ).toEqual([]);
  });

  it("rejects missing required fields", () => {
    expect(validateContribution("commands", { id: "x.run" })).toContain(
      "命令缺少 label",
    );
    expect(
      validateContribution("panels", { id: "x.panel", title: "Panel" }),
    ).toContain("面板缺少 renderer");
    expect(
      validateContribution("overlays", { id: "x.overlay" }),
    ).toContain("覆盖层缺少 renderer");
    expect(
      validateContribution("toolbarItems", {
        id: "x.toolbar",
        label: "Toolbar",
      }),
    ).toContain("工具栏项必须提供 component 或 commandId");
  });
});
