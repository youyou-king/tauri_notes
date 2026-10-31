import { describe, expect, it } from "vitest";
import { getCommand } from "../kernel/command";
import "./navCommands";
import { CORE_TOOLBAR_ITEMS } from "./coreToolbar";

describe("core toolbar", () => {
  it("owns the settings entry instead of a feature plugin", () => {
    const settings = CORE_TOOLBAR_ITEMS.find(
      (item) => item.id === "settings.open",
    );
    expect(settings).toMatchObject({
      id: "settings.open",
      commandId: "settings.open",
      order: 90,
    });
    expect(settings?.menu).toBeUndefined();
    expect(getCommand("settings.open")?.shortcut).toBe("mod+,");
  });
});
