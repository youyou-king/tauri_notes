import { describe, expect, it } from "vitest";
import { CORE_SETTINGS_SECTIONS } from "./SettingsDialog";

describe("settings sections", () => {
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
