import { describe, expect, it } from "vitest";
import { CORE_SETTINGS_SECTIONS } from "./SettingsDialog";

describe("settings sections", () => {
  it("owns storage maintenance in the shell", () => {
    expect(CORE_SETTINGS_SECTIONS).toContainEqual(
      expect.objectContaining({
        id: "core.storage",
        title: "数据",
        order: 80,
      }),
    );
  });

  it("owns plugin management in the shell", () => {
    expect(CORE_SETTINGS_SECTIONS).toContainEqual(
      expect.objectContaining({
        id: "core.plugins",
        title: "插件",
        order: 90,
      }),
    );
  });
});
