import { describe, expect, it } from "vitest";
import {
  getPanelDefaultTitle,
  getPanelDefinitions,
  getPanelIcon,
  registerPanel,
} from "./registry";

describe("panel registry", () => {
  it("registers panel identity and metadata", () => {
    registerPanel({
      id: "test.panel",
      component: () => null,
      icon: "🧪",
      defaultTitle: "测试面板",
      singleton: true,
    });

    expect(
      getPanelDefinitions().some((item) => item.id === "test.panel"),
    ).toBe(true);
    expect(getPanelIcon("test.panel")).toBe("🧪");
    expect(getPanelDefaultTitle("test.panel")).toBe("测试面板");
  });

  it("falls back for unknown panels", () => {
    expect(getPanelIcon("missing.panel")).toBe("▦");
    expect(getPanelDefaultTitle("missing.panel")).toBe("missing.panel");
  });
});
