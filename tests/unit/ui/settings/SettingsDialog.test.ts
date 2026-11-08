import { describe, expect, it } from "vitest";
import { CORE_SETTINGS_SECTIONS } from "../../../../src/ui/settings/SettingsDialog";

describe("settings sections", () => {
  it("owns file association in the shell", () => {
    expect(CORE_SETTINGS_SECTIONS).toContainEqual(
      expect.objectContaining({
        id: "core.file-association",
        title: "文件关联",
        order: 70,
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
